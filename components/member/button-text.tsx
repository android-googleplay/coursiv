"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { UiLanguageDocument } from "./ui-language-document";
import { translateUiText, type UiLanguage } from "./ui-translations";

export type ButtonLanguage = UiLanguage;

type ButtonLanguageContextValue = {
  language: ButtonLanguage;
  setLanguage: (language: ButtonLanguage) => void;
};

const ButtonLanguageContext = createContext<ButtonLanguageContextValue>({ language: "English", setLanguage: () => undefined });
const UI_LANGUAGE_STORAGE_KEY="coursiv.ui-language.v1";

export function ButtonLanguageProvider({ language, children }: { language: ButtonLanguage; children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const selectLanguage=useCallback((nextLanguage:ButtonLanguage)=>{setCurrentLanguage(nextLanguage);localStorage.setItem(UI_LANGUAGE_STORAGE_KEY,nextLanguage)},[]);
  useEffect(() => {
    const stored=localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    const nextLanguage=language==="繁體中文"?language:stored==="繁體中文"||stored==="English"?stored:language;
    setCurrentLanguage(nextLanguage);
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY,nextLanguage);
  }, [language]);
  return <ButtonLanguageContext.Provider value={{ language: currentLanguage, setLanguage: selectLanguage }}><UiLanguageDocument language={currentLanguage}/>{children}</ButtonLanguageContext.Provider>;
}

export function useButtonLanguage() {
  return useContext(ButtonLanguageContext);
}

export function translateButtonText(text: string, language: ButtonLanguage) {
  return translateUiText(text,language);
}

export function ButtonText({ children }: { children: string }) {
  const { language } = useButtonLanguage();
  return <>{translateButtonText(children, language)}</>;
}
