// middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import arcjet, { tokenBucket } from "@arcjet/next"

// Define protected routes (regex patterns)
const PROTECTED_ROUTES = [
    /^\/dashboard(\/.*)?$/,
    /^\/profile(\/.*)?$/,
    /^\/account(\/.*)?$/
]

// Define rate-limited routes (even for public endpoints)
const RATE_LIMITED_ROUTES = [
    /^\/api(\/.*)?$/,
    /^\/submit(\/.*)?$/
]

// Create Arcjet middleware for rate limiting/bot protection
const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    characteristics: ["userId"],
    rules: [
        tokenBucket({
            mode: "LIVE",
            refillRate: 5,    // 5 requests
            interval: 10,     // every 10 seconds
            capacity: 30      // max burst capacity
        })
    ]
})

// Base middleware for rate limiting, wrapped in withAuth to access token
export default withAuth(
    async function middleware(req) {
        const pathname = req.nextUrl.pathname
        const token = req.nextauth?.token

        // Apply rate limiting only to specific routes
        if (RATE_LIMITED_ROUTES.some(pattern => pattern.test(pathname))) {
            // Use .protect() method to apply Arcjet rate limiting
            const decision = await aj.protect(req, {
                // Add user identifier when available
                userId: token?.sub || "guest",
                requested: 1
            })

            // If Arcjet denied the request, return 429 response
            if (decision.isDenied()) {
                return NextResponse.json(
                    { error: "Too many requests" },
                    { status: 429 }
                )
            }
        }

        // Custom redirect for profile completion check no longer needed since we re using next-auth we getting this from registeration only.
        // if (pathname.startsWith('/dashboard') && token && !token.profileComplete) {
        //     return NextResponse.redirect(new URL('/complete-profile', req.url))
        // }

        return NextResponse.next()
    },
    {
        callbacks: {
            // This determines if the user is authorized for protected routes
            authorized: ({ token, req }) => {
                const pathname = req.nextUrl.pathname

                // For protected routes, require authentication
                if (PROTECTED_ROUTES.some(pattern => pattern.test(pathname))) {
                    return !!token
                }

                // For other routes, allow access regardless of auth status
                return true
            }
        },
        pages: {
            signIn: '/auth/signin',
        }
    }
)

export const config = {
    matcher: [
        // Match all paths except static files and auth callbacks
        "/((?!_next|api/auth|images|favicon.ico).*)"
    ]
}