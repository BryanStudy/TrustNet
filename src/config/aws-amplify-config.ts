const awsconfig = {
  Auth: {
    Cognito: {
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
          scopes: ["openid", "email", "profile"],
          redirectSignIn: [`${process.env.NEXT_PUBLIC_APP_BASE_URL}/landing`],
          redirectSignOut: [`${process.env.NEXT_PUBLIC_APP_BASE_URL}/login`],
          responseType: "code" as const,
        },
        email: true,
      },
    },
  },
};

export default awsconfig;
