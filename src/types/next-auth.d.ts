import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    canvasAccessToken?: string;
    googleAccessToken?: string;
    isFranklinTeacher?: boolean;
    canvasDomain?: string;
    error?: string;
  }
}
