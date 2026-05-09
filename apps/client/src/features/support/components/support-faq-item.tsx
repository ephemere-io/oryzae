'use client';

import { useState } from 'react';
import styles from './support.module.css';

interface SupportFaqItemProps {
  question: string;
  answer: string;
}

export function SupportFaqItem({ question, answer }: SupportFaqItemProps) {
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
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className={styles.faqA}>
          <p>{answer}</p>
        </div>
      ) : null}
    </li>
  );
}
