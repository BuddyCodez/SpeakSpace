import NextAuth, { AuthOptions, DefaultSession, getServerSession, NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient, UserRole, UserType } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next"
// Extend session with custom properties
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      userType: string;
    } & DefaultSession['user'];
  }
}

const prisma = new PrismaClient();
export const authOpts: AuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "Occupation", type: "text" }
      },
      async authorize(credentials) {
        // Sign-up flow
        if (credentials && credentials.username && credentials.email && credentials.password && credentials.userType) {
          // Validate occupation
          const validTypes = ['HR', 'STUDENT', 'JOBSEEKER', 'EMPLOYEE'];
          if (!validTypes.includes(credentials.userType)) {
            throw new Error('Invalid user type');
          }

          // Check if user exists
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.email },
                { username: credentials.username }
              ]
            }
          });

          if (existingUser) {
            throw new Error('User with this email or username already exists');
          }

          // Create new user
          const hashedPassword = await hash(credentials.password, 12);
          const newUser = await prisma.user.create({
            data: {
              username: credentials.username,
              email: credentials.email,
              password: hashedPassword,
              userType: credentials.userType as UserType,
              imageUrl: null
            }
          });

          return {
            id: newUser.id,
            name: newUser.username,
            email: newUser.email,
            userType: newUser.userType
          };
        }

        // Login flow
        if (credentials && credentials.email && credentials.password) {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            throw new Error('No user found with this email');
          }

          const isValid = await compare(credentials.password, user.password);
          if (!isValid) {
            throw new Error('Invalid password');
          }

          return {
            id: user.id,
            name: user.username,
            email: user.email,
            userType: user.userType
          };
        }

        throw new Error('Invalid credentials');
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.userType = (user as any).userType;
        token.picture = (user as any).image || null; // Assuming imageUrl is a field in your user model
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.userType = token.userType as string;
        session.user.image = token.picture as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }
};
export default NextAuth(authOpts);

export const config = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "Occupation", type: "text" }
      },
      async authorize(credentials) {
        // Sign-up flow
        if (credentials && credentials.username && credentials.email && credentials.password && credentials.userType) {
          // Validate occupation
          const validTypes = ['HR', 'STUDENT', 'JOBSEEKER', 'EMPLOYEE'];
          if (!validTypes.includes(credentials.userType)) {
            throw new Error('Invalid user type');
          }

          // Check if user exists
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.email },
                { username: credentials.username }
              ]
            }
          });

          if (existingUser) {
            throw new Error('User with this email or username already exists');
          }

          // Create new user
          const hashedPassword = await hash(credentials.password, 12);
          const newUser = await prisma.user.create({
            data: {
              username: credentials.username,
              email: credentials.email,
              password: hashedPassword,
              userType: credentials.userType as UserType,
              imageUrl: null
            }
          });

          return {
            id: newUser.id,
            name: newUser.username,
            email: newUser.email,
            userType: newUser.userType
          };
        }

        // Login flow
        if (credentials && credentials.email && credentials.password) {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            throw new Error('No user found with this email');
          }

          const isValid = await compare(credentials.password, user.password);
          if (!isValid) {
            throw new Error('Invalid password');
          }

          return {
            id: user.id,
            name: user.username,
            email: user.email,
            userType: user.userType
          };
        }

        throw new Error('Invalid credentials');
      }
    })
  ], // rest of your config
} satisfies NextAuthOptions
export function auth(
  ...args:
    | [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]]
    | [NextApiRequest, NextApiResponse]
    | []
) {
  return getServerSession(...args, config)
}