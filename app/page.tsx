"use client";

import { useEffect } from "react";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import FeatureTabs from "@/components/FeatureTabs";
import TechnicalDetails from "@/components/TechnicalDetails";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";

export default function Page() {
  // simple reveal-on-scroll
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Nav />
      <Hero />
      <FeatureTabs />
      <TechnicalDetails />
      <Footer />
      <div id="confetti-root"></div>
      <ChatWidget />
    </>
  );
}
