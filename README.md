# TrustNet
![TrustNetBanner](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/trustnet_thumbnail.png)

## Overview
TrustNet is a community-driven platform designed to help users identify and report digital threats such as phishing links, scam phone numbers, and fraudulent emails. This project was built to demonstrate practical system design using AWS, with emphasis on designing a scalable, observable, and secure backend architecture using managed cloud services.

## Architecture
![TrustNetArchitecture](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/aws_architecture_diagram.png)

TrustNet follows a serverless, API-driven architecture. 

The frontend is built with **Next.js (TypeScript)** and communicates with it's backend microservices through **Amazon API Gateway**, which routes requests to **AWS Lambda** functions. Business logic is stateless and horizontally scalable by design. Persistent data is stored in **Amazon DynamoDB**, chosen for its low-latency performance through GSI and flexible schema-design. File uploads are stored in **Amazon S3** for its affordability and security. Administrative workflows are handled using **Amazon SNS**, enabling users to receive email notifications when their reported threats have been successfully verified. Application monitoring and tracing are implemented using **Amazon CloudWatch** and **AWS X-Ray**, providing visibility into request flow, latency, and failures across distributed components. Access control is also enforced using **IAM users** with the principle of least privilege throughout development and deployment.

## Screenshots of AWS Implementation
### Amazon API Gateway
![TrustNetApiGatewayResources](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/api_gw_resources.png)
![TrustNetApiGatewayStages](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/api_gw_stages.png)

### AWS Lambda
![TrustNetLambdaFunctions](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/lambda_function.png)
![TrustNetLambdaServices](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/lambda_services.png)

### Amazon S3
![TrustNetS3BucketPolicy](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/s3_bucket_policy.png)
![TrustNetS3BucketFolders](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/s3_bucket_folders.png)

### Amazon DynamoDB
![TrustNetDynamoDBTables](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/dynamodb_tables.png)
![TrustNetDynamoDBExploreItems](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/dynamodb_explore_items.png)

### Amazon SNS
![TrustNetSnsTopics](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/sns_topics.png)
![TrustNetSnsNotification](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/sns_notification.png)

### AWS Elastic Beanstalk
![TrustNetElasticBeanstalk](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/elastic_beanstalk_env.png)

### AWS CloudWatch and X-Ray
![TrustNetCloudWatchAlarms](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/cloudwatch_alarms.png)
![TrustNetXrayTraceMap](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/xray_trace_map.png)

### AWS IAM
![TrustNetIamDashboard](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/iam_dashboard.png)
![TrustNetIamUsers](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/iam_user.png)

## Screenshots of System Functionalities

### Register Account
![TrustNetRegisterAccount](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/register_account.png)

### Digital Threats Directory
![TrustNetDigitalThreatsDirectory](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/digital_threats_directory.png)

### Digital Threats Details
![TrustNetDigitalThreatsDetails](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/digital_threats_details.png)

### Manage Digital Threats
![TrustNetManageDigitalThreats](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/manage_digital_threats.png)

### Scam Report Forum
![TrustNetScamReportForum](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/scam_report_forum.png)

### Scam Report Details
![TrustNetScamReportDetails](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/scam_report_details.png)

### Literacy Hub
![TrustNetLiteracyHub](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/literacy_hub.png)

### Educational Article
![TrustNetEducationalArticle](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/literacy_hub_article.png)

### Manage Users
![TrustNetManageUsers](https://github.com/BryanStudy/TrustNet/blob/main/public/screenshots/manage_users.png)

---

### License
- [MIT License](https://github.com/BryanStudy/TrustNet/blob/main/LICENSE)