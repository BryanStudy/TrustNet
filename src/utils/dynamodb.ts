import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const ACCESSKEYID = process.env.AWS_ACCESS_KEY_ID;
const SECRETACCESSKEY = process.env.AWS_SECRET_ACCESS_KEY;
const SESSIONTOKEN = process.env.AWS_SESSION_TOKEN;

if (!REGION || !ACCESSKEYID || !SECRETACCESSKEY) {
<<<<<<< Updated upstream
  throw new Error("AWS credentials are not set");
=======
  throw new Error("AWS credentials are not set for DynamoDB");
>>>>>>> Stashed changes
}

const client = new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESSKEYID,
    secretAccessKey: SECRETACCESSKEY,
    ...(SESSIONTOKEN && { sessionToken: SESSIONTOKEN }),
  }
});

const marshallOptions: TranslateConfig["marshallOptions"] = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};

const unmarshallOptions: TranslateConfig["unmarshallOptions"] = {
  wrapNumbers: false,
};

const translateConfig: TranslateConfig = {
  marshallOptions,
  unmarshallOptions,
};

const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig);

export default ddbDocClient; 