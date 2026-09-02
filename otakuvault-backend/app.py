#!/usr/bin/env python3
import aws_cdk as cdk

from cdk_tutorial_otaku_vault.otaku_vault_stack import OtakuVaultStack

app = cdk.App()

OtakuVaultStack(
    app, "OtakuVaultStack",
    env=cdk.Environment(account="835780011042", region="us-east-1"),
)

app.synth()
