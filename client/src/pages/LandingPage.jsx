import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-6 py-4 flex justify-between items-center border-b border-border">
        <h1 className="text-xl font-bold text-primary">StudySync</h1>
        <nav className="space-x-4">
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/signup">
            <Button>Sign Up</Button>
          </Link>
        </nav>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-primary mb-4">
          Your Real-Time <br /> Collaborative Study Workspace
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
          Create a study space, invite classmates, collaborate on notes and discussions, share resources, and work together in real time.
        </p>
        <div className="space-x-4">
          <Link to="/signup">
            <Button size="lg" className="h-12 px-8 text-lg">Get Started</Button>
          </Link>
          <Button variant="outline" size="lg" className="h-12 px-8 text-lg">Learn More</Button>
        </div>
      </main>

      <footer className="py-6 border-t border-border text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} StudySync. All rights reserved.
      </footer>
    </div>
  );
}
