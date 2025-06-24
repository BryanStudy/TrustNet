const awsconfig = {
  Auth: {
    Cognito: {
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: ['http://localhost:3000/landing'],
          redirectSignOut: ['http://localhost:3000/login'],
          responseType: 'code' as const, 
        },
        email: true,
      }
    }
  },
};

export default awsconfig;