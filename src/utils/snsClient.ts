import { SNSClient, SNSClientConfig } from "@aws-sdk/client-sns";

const REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const ACCESSKEYID = process.env.AWS_ACCESS_KEY_ID;
const SECRETACCESSKEY = process.env.AWS_SECRET_ACCESS_KEY;
const SESSIONTOKEN = process.env.AWS_SESSION_TOKEN;

if (!REGION || !ACCESSKEYID || !SECRETACCESSKEY) {
  throw new Error("AWS SNS configuration is not set");
}

const snsClientConfig: SNSClientConfig = {
  region: REGION,
  credentials: {
    accessKeyId: ACCESSKEYID,
    secretAccessKey: SECRETACCESSKEY,
    ...(SESSIONTOKEN && {
      sessionToken: SESSIONTOKEN,
    }),
  },
};

const snsClient = new SNSClient(snsClientConfig);

export default snsClient;
