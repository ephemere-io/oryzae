'use client';

import { useState } from 'react';
import styles from './landing.module.css';

interface LandingFaqItemProps {
  question: string;
  answer: string;
}

export function LandingFaqItem({ question, answer }: LandingFaqItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className={styles.faqItem}>
      <button
        type="button"
        className={styles.faqQ}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{question}</span>
        <span className={styles.faqToggle} aria-hidden="true">
          +
        </span>
      </button>
      <div className={styles.faqA}>
        <p>{answer}</p>
      </div>
    </li>
  );
}
