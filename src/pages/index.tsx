import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Users, Video, BarChart3, Clock, MessageSquare } from "lucide-react"
import Navbar from "@/components/navbar/navbar"

export default function Home() {
  return (
    <React.Fragment>
      <header>
        <Navbar />
      </header>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="pt-32 pb-20 md:pt-40 md:pb-32 bg-gradient-to-b from-background to-background/80">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Badge variant="outline" className="px-3 py-1 text-sm rounded-xl">
                Revolutionize Your Communication Skills
              </Badge>
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Unlock Your Full Potential in <span className="text-blue-600">Discussions & Interviews</span>
              </h1>
              <p className="max-w-[700px] text-muted-foreground md:text-xl">
                The ultimate real-time collaborative platform empowering students and professionals to excel in
                high-stakes communication scenarios.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button size="lg" asChild>
                  <Link href="/register">Start Your Journey</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#how-it-works">Discover More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Powerful Features</h2>
              <p className="max-w-[700px] text-muted-foreground md:text-lg">
                Cutting-edge tools designed to transform your communication abilities and boost your career prospects.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Users className="h-10 w-10 text-blue-600" />}
                title="Dynamic Role-based Sessions"
                description="Immerse yourself in specialized practice as a Moderator, Participant, or Evaluator for authentic skill development."
              />
              <FeatureCard
                icon={<Clock className="h-10 w-10 text-blue-600" />}
                title="Intelligent Session Management"
                description="Effortlessly create customized sessions with advanced topic selection, precision timers, and seamless participant coordination."
              />
              <FeatureCard
                icon={<MessageSquare className="h-10 w-10 text-blue-600" />}
                title="Interactive Discussion Rooms"
                description="Engage in crystal-clear real-time text conversations and premium voice discussions for maximum impact."
              />
              <FeatureCard
                icon={<CheckCircle className="h-10 w-10 text-blue-600" />}
                title="Comprehensive Feedback System"
                description="Receive detailed, actionable insights with professional ratings on every aspect of your communication performance."
              />
              <FeatureCard
                icon={<BarChart3 className="h-10 w-10 text-blue-600" />}
                title="Advanced Analytics Dashboard"
                description="Visualize your progress with stunning charts and identify key improvement opportunities with AI-powered insights."
              />
              <FeatureCard
                icon={<Video className="h-10 w-10 text-blue-600" />}
                title="Realistic Interview Simulation"
                description="Master high-pressure scenarios with industry-specific simulations that prepare you for real-world success."
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">How It Works</h2>
              <p className="max-w-[700px] text-muted-foreground md:text-lg">
                Simple steps to improve your communication skills
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StepCard
                number="01"
                title="Create an Account"
                description="Sign up and choose your role: Moderator, Participant, or Evaluator."
              />
              <StepCard
                number="02"
                title="Join or Create a Session"
                description="Set up a new discussion or join an existing one with your peers."
              />
              <StepCard
                number="03"
                title="Practice & Get Feedback"
                description="Participate in discussions and receive detailed feedback to improve."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-blue-600 text-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Ready to Transform Your Communication Skills?
              </h2>
              <p className="max-w-[700px] md:text-xl">
                Join thousands of successful professionals who've elevated their careers through SpeakSpace's
                revolutionary platform.
              </p>
              <Button size="lg" variant="secondary" className="mt-6" asChild>
                <Link href="/register">Launch Your Success Story</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 md:py-12 border-t">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl">SpeakSpace</span>
              </div>
              <span className="flex flex-col gap-y-1 items-center">
                <p className="text-sm text-muted-foreground">© 2025 SpeakSpace. All rights reserved.</p>
                <p className="text-sm text-muted-foreground">Crafted with ❤️ by <Link href="https://uditvegad.vercel.app" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Udit Vegad</Link>.</p>
              </span>
              <div className="flex items-center gap-4">
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms of Service
                </Link>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </React.Fragment>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="transition-all duration-200 hover:scale-95 hover:shadow-md hover:shadow-blue-900/50 dark:hover:shadow-blue-900/20">
      <CardHeader>
        <div className="mb-2">{icon}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  )
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-xl mb-4">
        {number}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
