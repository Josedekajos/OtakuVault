from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_s3 as s3,
)
from constructs import Construct


class OtakuVaultStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ============================================================
        # COGNITO USER POOL
        # ============================================================
        # This is the actual identity system. Users sign up, verify
        # their email, and log in against this pool. Nothing else in
        # this stack decides who a user is - API Gateway will later
        # trust tokens issued by this pool, and only this pool.
        # ============================================================
        user_pool = cognito.UserPool(
            self, "OtakuVaultUserPool",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            # DESTROY is fine for a learning/internship project - it means
            # `cdk destroy` also deletes every signed-up user. Don't use
            # this removal policy on a real production user pool.
            removal_policy=RemovalPolicy.DESTROY,
        )

        # The app client is what Amplify uses in the browser to talk to
        # Cognito. No client secret - a browser can't keep a secret safe,
        # so Cognito app clients for browser apps must not have one.
        user_pool_client = user_pool.add_client(
            "OtakuVaultUserPoolClient",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
        )

        # ============================================================
        # DYNAMODB TABLES
        # ============================================================
        users_table = dynamodb.Table(
            self, "UsersTable",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        characters_table = dynamodb.Table(
            self, "CharactersTable",
            partition_key=dynamodb.Attribute(
                name="characterId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # This GSI is what makes "give me all of MY characters" a single,
        # cheap query instead of a full table scan filtered in Lambda.
        # Partition key = userId, so every query is automatically scoped
        # to one user's data.
        characters_table.add_global_secondary_index(
            index_name="UserCharactersIndex",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # ============================================================
        # S3 BUCKET FOR CHARACTER IMAGES
        # ============================================================
        # Fully private - BLOCK_ALL means no public access is possible
        # even by accident. Uploads happen via a Lambda-generated
        # pre-signed PUT URL, and viewing happens via a Lambda-generated
        # pre-signed GET URL (built in Stage 3). The CORS rule below only
        # allows the browser to PUT directly to S3 using that pre-signed
        # URL - it does not make objects readable to the public.
        # ============================================================
        images_bucket = s3.Bucket(
            self, "CharacterImagesBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT],
                    # Tighten this to your deployed frontend's real URL
                    # once you have one - "*" is fine for local dev.
                    allowed_origins=["*"],
                    allowed_headers=["*"],
                )
            ],
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # ============================================================
        # LAMBDA FUNCTION
        # ============================================================
        # One function handles every route for now (routing happens
        # inside index.py by checking httpMethod + resource, same
        # pattern as your last project). Stage 3 will fill in the
        # real CRUD/upload logic - right now it's a placeholder so
        # this stack deploys successfully on its own.
        # ============================================================
        api_handler = _lambda.Function(
            self, "OtakuVaultFunction",
            runtime=_lambda.Runtime.PYTHON_3_13,
            handler="index.handler",
            code=_lambda.Code.from_asset("lambda"),
            architecture=_lambda.Architecture.ARM_64,
            timeout=Duration.seconds(10),
            memory_size=128,
            environment={
                "USERS_TABLE_NAME": users_table.table_name,
                "CHARACTERS_TABLE_NAME": characters_table.table_name,
                "BUCKET_NAME": images_bucket.bucket_name,
            },
        )

        # Least-privilege grants - this Lambda can only touch exactly
        # the three resources it needs, nothing else in the account.
        users_table.grant_read_write_data(api_handler)
        characters_table.grant_read_write_data(api_handler)
        images_bucket.grant_read_write(api_handler)

        # ============================================================
        # API GATEWAY + COGNITO AUTHORIZER
        # ============================================================
        # This authorizer is what actually protects every route below.
        # API Gateway verifies the incoming JWT's signature and expiry
        # against this User Pool BEFORE Lambda ever runs. An invalid or
        # missing token never reaches Lambda at all.
        # ============================================================
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self, "OtakuVaultAuthorizer",
            cognito_user_pools=[user_pool],
        )

        api = apigw.RestApi(
            self, "otakuVaultApi",
            rest_api_name="OtakuVault Service",
            description="Authenticated CRUD API for anime characters",
            default_cors_preflight_options=apigw.CorsOptions(
                # Tighten to your deployed frontend URL later - "*" plus
                # localhost:5173 covers local development for now.
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # --------------------------------------------------------------
        # 401/403 Gateway Responses need CORS headers explicitly added.
        # Without this, when Cognito rejects a request (expired/missing
        # token), API Gateway's default error response has NO CORS
        # headers on it - so instead of seeing a clear 401, the browser
        # reports "CORS header 'Access-Control-Allow-Origin' missing",
        # which is confusing and hides the real problem. This is exactly
        # the issue you ran into before, so it's fixed here at the
        # infrastructure level.
        # --------------------------------------------------------------
        api.add_gateway_response(
            "UnauthorizedResponse",
            type=apigw.ResponseType.UNAUTHORIZED,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        )
        api.add_gateway_response(
            "AccessDeniedResponse",
            type=apigw.ResponseType.ACCESS_DENIED,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        )

        integration = apigw.LambdaIntegration(api_handler)

        # Every method below is deliberately wired to the SAME authorizer.
        # There is no public/unauthenticated route anywhere in this API.
        cognito_auth = {
            "authorizer": authorizer,
            "authorization_type": apigw.AuthorizationType.COGNITO,
        }

        # ------------------------------------------------------------
        # /characters
        # ------------------------------------------------------------
        characters = api.root.add_resource("characters")
        characters.add_method("GET", integration, **cognito_auth)   # list my characters
        characters.add_method("POST", integration, **cognito_auth)  # create a character

        # ------------------------------------------------------------
        # /characters/{characterId}
        # ------------------------------------------------------------
        character = characters.add_resource("{characterId}")
        character.add_method("GET", integration, **cognito_auth)     # get one (if mine)
        character.add_method("PUT", integration, **cognito_auth)     # update (if mine)
        character.add_method("DELETE", integration, **cognito_auth)  # delete (if mine)

        # ------------------------------------------------------------
        # /upload
        # ------------------------------------------------------------
        upload = api.root.add_resource("upload")
        upload.add_method("POST", integration, **cognito_auth)  # get a pre-signed S3 URL

        # ============================================================
        # OUTPUTS
        # ============================================================
        # These print after `cdk deploy` and are exactly what you'll
        # paste into the React frontend's config.js / Amplify config
        # in Stage 5.
        # ============================================================
        CfnOutput(self, "ApiUrl", value=api.url,
                  description="Base API Gateway URL")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id,
                  description="Cognito User Pool ID")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id,
                  description="Cognito App Client ID (no secret)")
        CfnOutput(self, "UsersTableName", value=users_table.table_name,
                  description="DynamoDB Users table name")
        CfnOutput(self, "CharactersTableName", value=characters_table.table_name,
                  description="DynamoDB Characters table name")
        CfnOutput(self, "ImagesBucketName", value=images_bucket.bucket_name,
                  description="S3 bucket for character images")
