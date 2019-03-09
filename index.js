'use strict';

const { spawn } = require('child_process');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      deploy: {
        lifecycleEvents: [
          'resources'
        ]
      },
      publishWebapp: {
        usage: 'Publishes the `WebApp` directory to your bucket',
        lifecycleEvents: [
          'publish',
        ],
      },
      domainInfo: {
        usage: 'Fetches and prints out the deployed CloudFront domain names',
        lifecycleEvents: [
          'domainInfo',
        ],
      },
      buildWebapp: {
        usage: 'Builds the frontend in the `WebApp` directory',
        lifecycleEvents: [
          'build',
        ],
      },
      deployWebapp: {
        usage: 'Builds and publishes the frontend',
        lifecycleEvents: [
          'deploy',
        ],
      }
    };

    this.hooks = {
      'after:deploy:deploy': this.autoDeploy.bind(this),
      'publishWebapp:publish': this.publishApp.bind(this),
      'domainInfo:domainInfo': this.domainInfo.bind(this),
      'buildWebapp:build': this.buildApp.bind(this),
      'deployWebapp:deploy': this.deployApp.bind(this),
    };
  }

  async autoDeploy() {
    if (this.serverless.variables.service.custom.oneCmdDeploy){
      this.serverless.cli.log('Initiating webapp deployment...');
      await this.deployApp();
    }
  }
  
  async runCommand(cmd, args){
    const result = spawn(cmd, args);
    let stderr;

    result.stdout.on('data', data => this.serverless.cli.log(data));
    result.stderr.on('data', data => {
      this.serverless.cli.log(`Error: ${data}`);
      stderr += data;
    });

    await (new Promise((res, rej) => {
      result.on('close', code => res(code));
    }))
    return { stderr };
  }

  runAwsCommand(args) {
    return this.runCommand('aws', args);
  }

  async deployApp(){
    await this.buildApp();
    await this.publishApp();
  }

  async buildApp(){
    const buildScript = this.serverless.variables.service.custom.buildCommand;
    if (!buildScript){
      this.serverless.cli.log(`Error: Could not find 'buildCommand' in custom variables`);
      throw new Error(`Could not find 'buildCommand' in custom variables`);
    }
    this.serverless.cli.log('Running build command...');
    const { stderr } = await this.runCommand('npm', ['run', buildScript]);
    if (!stderr){
      this.serverless.cli.log('Build successful!');
    } else {
      throw new Error(`Unable to build webapp`);
    }
  }

  // publish webapp directory to the provided bucket
  async publishApp() {
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket;
    const localBuildPath = this.serverless.variables.service.custom.appBuildPath;
    const args = [
      's3',
      'sync',
      localBuildPath,
      `s3://${s3Bucket}/`,
      '--delete',
    ];
    this.serverless.cli.log(`Publishing webapp to '${s3Bucket}'...`);
    const { stderr } = await this.runAwsCommand(args);
    if (!stderr) {
      this.serverless.cli.log('Successfully published to the S3 bucket');
    } else {
      throw new Error('Failed syncing to the S3 bucket');
    }
  }

  // fetches the domain name from the CloudFront outputs and prints it out
  async domainInfo() {
    const provider = this.serverless.getProvider('aws');
    const stackName = provider.naming.getStackName(this.options.stage);
    const result = await provider.request(
      'CloudFormation',
      'describeStacks',
      { StackName: stackName },
      this.options.stage,
      this.options.region,
    );

    const outputs = result.Stacks[0].Outputs;
    const output = outputs.find(
      entry => entry.OutputKey === 'WebAppCloudFrontDistributionOutput',
    );

    if (output && output.OutputValue) {
      this.serverless.cli.log(`Web App Domain: ${output.OutputValue}`);
      return output.OutputValue;
    }

    this.serverless.cli.log('Web App Domain: Not Found');
    const error = new Error('Could not extract Web App Domain');
    throw error;
  }
}

module.exports = ServerlessPlugin;

