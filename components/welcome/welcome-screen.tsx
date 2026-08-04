"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyPlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WelcomeScreen({ userName }: { userName: string }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  async function handleCreate(formData: FormData) {
    console.log("here")
    setIsCreating(true);
    try {
      console.log("here2")
      const roomName = String(formData.get("roomName") ?? "");
      const data = await fetchJson<{ roomId: string }>("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName }),
      });
      
      console.log("here3")
      toast.success("Room created.");
      router.push(`/rooms/${data.roomId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin(formData: FormData) {
    setIsJoining(true);
    console.log("here")
    try {
      const roomCode = String(formData.get("roomCode") ?? "");
      const data = await fetchJson<{ roomId: string }>("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });

      toast.success("Room joined.");
      router.push(`/rooms/${data.roomId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to join room.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-2">
        <Card className="surface rounded-[2rem] p-8">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <CopyPlus className="h-5 w-5" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Welcome, {userName}.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Create your own room or join one with a code. Once you’re inside, everything
              syncs automatically.
            </p>
          </div>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">New room name</Label>
              <Input
                id="roomName"
                name="roomName"
                required
                placeholder="Personal workspace"
                className="h-12 rounded-2xl"
              />
            </div>
            <Button type="submit" disabled={isCreating} className="h-12 w-full rounded-2xl">
              <Plus className="mr-2 h-4 w-4" />
              {isCreating ? "Creating..." : "Create room"}
            </Button>
          </form>
        </Card>

        <Card className="surface rounded-[2rem] p-8">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Search className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Join with a room code</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Enter the code from another device or teammate to open the same shared space.
            </p>
          </div>
          <form action={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomCode">Room code</Label>
              <Input
                id="roomCode"
                name="roomCode"
                required
                placeholder="4F8M2K7Q"
                className="h-12 rounded-2xl uppercase"
              />
            </div>
            <Button type="submit" disabled={isJoining} variant="secondary" className="h-12 w-full rounded-2xl">
              {isJoining ? "Joining..." : "Join room"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
