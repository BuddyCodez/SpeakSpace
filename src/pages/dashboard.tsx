"use client"

import { useState, useEffect } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import {
  Users,
  Calendar,
  BarChart3,
  MessageSquare,
  Clock,
  User,
  Settings,
  LogOut,
  Video,
  Mic,
  Menu,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { SessionSheet } from "@/components/session/session-sheet"
import { trpc } from "@/utils/trpc"
import { useSession } from "next-auth/react"

export default function Dashboard() {
  const [userRole, setUserRole] = useState<"moderator" | "participant" | "evaluator">("participant")
  const [scrolled, setScrolled] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { scrollY } = useScroll()
  const { data: session } = useSession()

  // Get user sessions
  const { data: sessions, isLoading: isLoadingSessions } = trpc.session.getMySessions.useQuery()

  // Header animation values
  const headerOpacity = useTransform(scrollY, [0, 50], [1, 0.98])
  const headerScale = useTransform(scrollY, [0, 50], [1, 0.98])
  const headerShadow = useTransform(scrollY, [0, 50], [0, 8])

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const roleColor = {
    moderator: "bg-[#0A65CC]",
    participant: "bg-[#0A65CC]",
    evaluator: "bg-[#0A65CC]",
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-full w-64 bg-background shadow-lg"
        initial={{ width: "16rem", x: 0 }}
        animate={{
          width: sidebarOpen ? "16rem" : "0rem",
          x: sidebarOpen ? 0 : "-16rem"
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-2 border-b p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A65CC]">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">SpeakSpace</h2>
            <p className="text-xs text-muted-foreground">GD & Interview Skills</p>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="p-2">
          {/* Main Navigation */}
          <div className="mb-6">
            <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Main</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="#"
                  className="flex items-center rounded-md bg-[#0A65CC] px-3 py-2 text-sm font-medium text-white"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Sessions</span>
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>Analytics</span>
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Feedback</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Account Navigation */}
          <div>
            <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Account</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </a>
              </li>
              <li>
                <Link
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {/* <SignOutButton>Logout</SignOutButton> */}
                  LogOut
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t p-4">
          <div className="flex items-center gap-2">
           User Button.
            <div>
              <p className="text-sm font-medium">{session?.user?.name}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? "ml-64" : "ml-0"}`}>
        {/* Header */}
        <motion.header
          className={`sticky top-0 z-40 flex h-16 items-center border-b px-6 transition-all ${scrolled ? "shadow-md" : ""}`}
          style={{
            opacity: headerOpacity,
            scale: headerScale,
            boxShadow: `${headerShadow.get()}px 0px 10px rgba(0,0,0,0.1)`,
          }}
        >
          <button
            className="mr-4 rounded-md p-2 hover:bg-muted"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="ml-auto">
            <Tabs defaultValue="participant" className="w-[400px]">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="participant"
                  onClick={() => setUserRole("participant")}
                  className="data-[state=active]:bg-[#0A65CC] data-[state=active]:text-white"
                >
                  Participant
                </TabsTrigger>
                <TabsTrigger
                  value="moderator"
                  onClick={() => setUserRole("moderator")}
                  className="data-[state=active]:bg-[#0A65CC] data-[state=active]:text-white"
                >
                  Moderator
                </TabsTrigger>
                <TabsTrigger
                  value="evaluator"
                  onClick={() => setUserRole("evaluator")}
                  className="data-[state=active]:bg-[#0A65CC] data-[state=active]:text-white"
                >
                  Evaluator
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="grid gap-6">
            {/* Welcome Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className="border-[#0A65CC]/20">
                <CardHeader className="pb-2">
                  <CardTitle>Welcome back, {session?.user?.name || "User"}!</CardTitle>
                  <CardDescription>Here's what's happening with your {userRole} activities today.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-[#0A65CC]/10 p-2">
                        <Calendar className="h-4 w-4 text-[#0A65CC]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Upcoming Sessions</p>
                        <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-[#0A65CC]/10 p-2">
                        <MessageSquare className="h-4 w-4 text-[#0A65CC]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Feedback Received</p>
                        <p className="text-2xl font-bold">12</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-[#0A65CC]/10 p-2">
                        <BarChart3 className="h-4 w-4 text-[#0A65CC]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Skill Progress</p>
                        <p className="text-2xl font-bold">68%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Sessions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
                <SessionSheet
                  variant={userRole === "moderator" ? "create" : "both"}
                  defaultTab={userRole === "moderator" ? "create" : "join"}
                  buttonText={userRole === "moderator" ? "Create Session" : "Join Session"}
                  buttonIcon={true}
                  className="bg-[#0A65CC] hover:bg-[#0A65CC]/90"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {isLoadingSessions ? (
                  <p>Loading sessions...</p>
                ) : sessions && sessions.length > 0 ? (
                  sessions.map((session) => (
                    <motion.div
                      key={session.id}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Card className="border-[#0A65CC]/20">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle>{session.title}</CardTitle>
                            <Badge className="bg-[#0A65CC]">Active</Badge>
                          </div>
                          <CardDescription>
                            {session.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            {session.communicationModes.includes("VIDEO") && (
                              <Video className="h-4 w-4 text-muted-foreground" />
                            )}
                            {session.communicationModes.includes("VOICE") && (
                              <Mic className="h-4 w-4 text-muted-foreground" />
                            )}
                            {session.communicationModes.includes("CHAT") && (
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {session.communicationModes.map(mode => {
                                switch (mode) {
                                  case "CHAT": return "Chat";
                                  case "VOICE": return "Voice";
                                  case "VIDEO": return "Video";
                                  default: return mode;
                                }
                              }).join(", ")}
                            </span>
                          </div>
                          <div className="mt-4">
                            <p className="text-sm font-medium">Type</p>
                            <p className="text-sm text-muted-foreground">
                              {session.sessionType === "GROUP_DISCUSSION"
                                ? "Group Discussion"
                                : "Interview"}
                            </p>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Link href={`/dashboard/session/${session.id}`} className="w-full">
                            <Button className="w-full bg-[#0A65CC] hover:bg-[#0A65CC]/90">
                              {userRole === "moderator"
                                ? "Manage Session"
                                : userRole === "evaluator"
                                  ? "Review Session"
                                  : "Join Session"}
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-8">
                    <p className="text-muted-foreground">No active sessions found.</p>
                    <p className="mt-2">
                      {userRole === "moderator"
                        ? "Create a new session to get started."
                        : "Join a session using a code to get started."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Performance & Feedback */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card className="border-[#0A65CC]/20">
                <CardHeader>
                  <CardTitle>Skill Progress</CardTitle>
                  <CardDescription>Your performance across different skills</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Communication</p>
                        <p className="text-sm text-muted-foreground">85%</p>
                      </div>
                      <Progress value={85} className="h-2" style={{ backgroundColor: "#0A65CC20" }}>
                        <div
                          className="h-full bg-[#0A65CC]"
                          style={{ width: "85%" }}
                          role="progressbar"
                          aria-valuenow={85}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </Progress>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Critical Thinking</p>
                        <p className="text-sm text-muted-foreground">72%</p>
                      </div>
                      <Progress value={72} className="h-2" style={{ backgroundColor: "#0A65CC20" }}>
                        <div
                          className="h-full bg-[#0A65CC]"
                          style={{ width: "72%" }}
                          role="progressbar"
                          aria-valuenow={72}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </Progress>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Problem Solving</p>
                        <p className="text-sm text-muted-foreground">68%</p>
                      </div>
                      <Progress value={68} className="h-2" style={{ backgroundColor: "#0A65CC20" }}>
                        <div
                          className="h-full bg-[#0A65CC]"
                          style={{ width: "68%" }}
                          role="progressbar"
                          aria-valuenow={68}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </Progress>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Leadership</p>
                        <p className="text-sm text-muted-foreground">54%</p>
                      </div>
                      <Progress value={54} className="h-2" style={{ backgroundColor: "#0A65CC20" }}>
                        <div
                          className="h-full bg-[#0A65CC]"
                          style={{ width: "54%" }}
                          role="progressbar"
                          aria-valuenow={54}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </Progress>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#0A65CC]/20">
                <CardHeader>
                  <CardTitle>Recent Feedback</CardTitle>
                  <CardDescription>Latest evaluations from your sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src="/placeholder.svg?height=40&width=40&text=E1" />
                        <AvatarFallback>E1</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">Technical Interview Session</p>
                          <Badge variant="outline" className="text-xs text-[#0A65CC] border-[#0A65CC]/30">
                            3 days ago
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          "Good technical knowledge but needs to improve on explaining complex concepts in simpler
                          terms."
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src="/placeholder.svg?height=40&width=40&text=E2" />
                        <AvatarFallback>E2</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">Group Discussion</p>
                          <Badge variant="outline" className="text-xs text-[#0A65CC] border-[#0A65CC]/30">
                            1 week ago
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          "Excellent points raised during the discussion. Could improve on allowing others to speak
                          more."
                        </p>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" style={{ borderColor: "#0A65CC40", color: "#0A65CC" }}>
                      View All Feedback
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Role-specific Section */}
            {userRole === "moderator" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="border-[#0A65CC]/20">
                  <CardHeader>
                    <CardTitle>Moderator Tools</CardTitle>
                    <CardDescription>Manage your sessions and participants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <SessionSheet
                        variant="create"
                        buttonText="Create New Session"
                        buttonVariant="default"
                        className="h-24 flex-col gap-2 bg-[#0A65CC] hover:bg-[#0A65CC]/90"
                      />
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2"
                        style={{ borderColor: "#0A65CC40", color: "#0A65CC" }}
                      >
                        <Users className="h-6 w-6" />
                        <span>Manage Participants</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2"
                        style={{ borderColor: "#0A65CC40", color: "#0A65CC" }}
                      >
                        <Clock className="h-6 w-6" />
                        <span>Session Templates</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {userRole === "evaluator" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="border-[#0A65CC]/20">
                  <CardHeader>
                    <CardTitle>Pending Evaluations</CardTitle>
                    <CardDescription>Sessions that need your feedback</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-[#0A65CC]/10 p-2">
                            <Clock className="h-4 w-4 text-[#0A65CC]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Technical Interview - React Developer</p>
                            <p className="text-xs text-muted-foreground">4 participants waiting for feedback</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-[#0A65CC] hover:bg-[#0A65CC]/90">
                          Evaluate
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-[#0A65CC]/10 p-2">
                            <Clock className="h-4 w-4 text-[#0A65CC]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Group Discussion - Remote Work Culture</p>
                            <p className="text-xs text-muted-foreground">6 participants waiting for feedback</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-[#0A65CC] hover:bg-[#0A65CC]/90">
                          Evaluate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}