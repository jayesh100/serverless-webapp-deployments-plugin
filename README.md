# serverless-webapp-deployments-plugin

### THIS IS AN EXTENDED VERSION OF 'serverless-single-page-app-plugin' WITH MINOR CHANGES FOR A PARTICULAR USE CASE

A plugin for [Serverless Framework](https://serverless.com), to simplify deploying a Webapp on S3. 

Based on the [official example](https://github.com/serverless/examples/tree/master/aws-node-single-page-app-via-cloudfront/serverless-single-page-app-plugin), with some important tweaks:

- Auto-generated bucket name, to allow multiple independent deployments without name-clashes
- Packaged as its own repo, so that it can be re-used and independently versioned
- Build your web app : `serverless buildWebapp`
- Publish your web app (to s3) : `serverless publishWebapp`
- Deploy (build + publish) : `serverless deployWebapp`
- One command deployments (with `sls deploy`)

## Installation

Install the package via NPM:

```bash
npm install serverless-webapp-deployments-plugin
```

Then register it in your `serverless.yml` file, as a plugin:

```
plugins:
  - serverless-webapp-deployments-plugin
```

And set `s3Bucket`, `appBuildPath`, `buildCommand`, `oneCmdDeploy` custom variables:

```
custom:
  s3Bucket: my-special-bucket # Name of s3 bucket
  appBuildPath: webapp/dist # Location of the build path (contains index.html)
  buildCommand: build-app # The npm script run to build the webapp
  oneCmdDeploy: true # Deploys webapp immediately after 'sls deploy' is run - false by default
```

Finally, add appropriately-named resources (Bucket and BucketPolicy) and Outputs:

```
resources:
  Resources:
    # Specifying the S3 Bucket
    WebAppS3Bucket:
      Type: AWS::S3::Bucket
      Properties:
        BucketName: ${self:custom.s3Bucket}
        AccessControl: PublicRead
        WebsiteConfiguration:
          IndexDocument: index.html
          ErrorDocument: index.html
    # Specifying the policies to make sure all files inside the Bucket are avaialble
    WebAppS3BucketPolicy:
      Type: AWS::S3::BucketPolicy
      Properties:
        Bucket:
          Ref: WebAppS3Bucket
        PolicyDocument:
          Statement:
            - Sid: PublicReadGetObject
              Effect: Allow
              Principal: '*'
              Action:
              - s3:GetObject
              Resource:
                Fn::Join:
                  - ''
                  -
                    - 'arn:aws:s3:::'
                    - !Ref WebAppS3Bucket
                    - '/*'

  # In order to print out the hosted domain we can run `serverless info`
  Outputs:
    WebAppS3Bucket:
      Value: !GetAtt WebAppS3Bucket DomainName
```
