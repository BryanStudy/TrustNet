/**
 * Constructs a full S3 file URL from a filename and folder path
 */
export function constructFileUrl(fileName: string, folderPath?: string): string {
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
  const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-southeast-1";
  
  if (!bucketName) {
    console.error("NEXT_PUBLIC_S3_BUCKET_NAME environment variable is not set");
    console.error("Please add NEXT_PUBLIC_S3_BUCKET_NAME=trustnet-bucket to your .env.local file");
    return "";
  }

  const key = folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;

  const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  console.log("Constructed URL:", url);
  
  return url;
}
