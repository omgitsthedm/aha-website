'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { useGSAP } from '@gsap/react';

// Register plugins ONCE at module level
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);
}

export { gsap, ScrollTrigger, MotionPathPlugin, useGSAP };
