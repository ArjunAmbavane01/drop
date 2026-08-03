function readEnvValue(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  get databaseUrl() {
    return readEnvValue("DATABASE_URL");
  },
  get betterAuthSecret() {
    return readEnvValue("BETTER_AUTH_SECRET");
  },
  get betterAuthUrl() {
    return readEnvValue("BETTER_AUTH_URL");
  },
  get r2AccountId() {
    return readEnvValue("R2_ACCOUNT_ID");
  },
  get r2AccessKeyId() {
    return readEnvValue("R2_ACCESS_KEY_ID");
  },
  get r2SecretAccessKey() {
    return readEnvValue("R2_SECRET_ACCESS_KEY");
  },
  get r2BucketName() {
    return readEnvValue("R2_BUCKET_NAME");
  },
  get r2PublicBaseUrl() {
    return readEnvValue("R2_PUBLIC_BASE_URL");
  },
};
