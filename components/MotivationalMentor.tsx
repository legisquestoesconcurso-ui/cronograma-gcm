'use client';

import React, { useState, useEffect } from 'react';

export const MOTIVATIONAL_PHRASES = [
  "O treinamento difícil faz o combate fácil.",
  "Sua farda está sendo tecida hoje.",
  "A disciplina é a alma de um exército.",
  "Vencer a si mesmo é a maior das vitórias.",
  "O suor no treinamento poupa o sangue no campo.",
  "A farda não é apenas uma roupa, é um compromisso.",
  "Persista! A aprovação é o prêmio da constância.",
  "Cada questão resolvida é um passo rumo à sua farda.",
  "GCM: Servir e Proteger começa com o seu estudo.",
  "Não pare até se orgulhar de quem você se tornou."
];

export default function MotivationalPhrase() {
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    // Small delay to avoid synchronous state update in effect which triggers lint warning
    const timer = setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length);
      setPhrase(MOTIVATIONAL_PHRASES[randomIndex]);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!phrase) return null;

  return (
    <p className="text-blue-600 font-medium italic text-lg sm:text-xl tracking-wide animate-in fade-in duration-700">
      &quot;{phrase}&quot;
    </p>
  );
}
