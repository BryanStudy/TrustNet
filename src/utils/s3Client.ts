import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

const REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const ACCESSKEYID = process.env.AWS_ACCESS_KEY_ID;
const SECRETACCESSKEY = process.env.AWS_SECRET_ACCESS_KEY;
const SESSIONTOKEN = process.env.AWS_SESSION_TOKEN;

if (!REGION || !ACCESSKEYID || !SECRETACCESSKEY || !SESSIONTOKEN) {
  throw new Error("AWS credentials are not set");
}

const s3ClientConfig: S3ClientConfig = {
  region: REGION,
  credentials: {
    accessKeyId: ACCESSKEYID,
    secretAccessKey: SECRETACCESSKEY,
    sessionToken: SESSIONTOKEN,
  },
};

export const s3Client = new S3Client(s3ClientConfig);
