"use client";

import { useEffect } from "react";
import { translateUiText, type UiLanguage, uiTranslationAttributes } from "./ui-translations";

const ignoredParents = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

function canTranslateTextNode(node: Text) {
  const parent = node.parentElement;
  return Boolean(parent && !ignoredParents.has(parent.tagName) && !parent.closest("[data-ui-translate='off']") && !parent.isContentEditable);
}

export function UiLanguageDocument({language}:{language:UiLanguage}) {
  useEffect(()=>{
    document.documentElement.dataset.uiLanguage=language;
    if(language==="English")return;

    const originalText=new Map<Text,string>();
    const originalAttributes=new Map<Element,Map<string,string>>();

    const translateTextNode=(node:Text)=>{
      if(!canTranslateTextNode(node))return;
      const current=node.nodeValue??"";
      const previousOriginal=originalText.get(node);
      if(previousOriginal!==undefined&&current===translateUiText(previousOriginal,language))return;
      const translated=translateUiText(current,language);
      if(translated===current)return;
      originalText.set(node,current);
      node.nodeValue=translated;
    };

    const translateAttributes=(element:Element)=>{
      for(const attribute of uiTranslationAttributes){
        const current=element.getAttribute(attribute);
        if(!current)continue;
        const translated=translateUiText(current,language);
        if(translated===current)continue;
        let originals=originalAttributes.get(element);
        if(!originals){originals=new Map();originalAttributes.set(element,originals)}
        originals.set(attribute,current);
        element.setAttribute(attribute,translated);
      }
    };

    const translateTree=(root:Node)=>{
      if(root.nodeType===Node.TEXT_NODE){translateTextNode(root as Text);return}
      if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
      if(root instanceof Element)translateAttributes(root);
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      let current:Node|null=walker.nextNode();
      while(current){
        if(current.nodeType===Node.TEXT_NODE)translateTextNode(current as Text);
        else translateAttributes(current as Element);
        current=walker.nextNode();
      }
    };

    translateTree(document.body);
    const observer=new MutationObserver((mutations)=>{
      for(const mutation of mutations){
        if(mutation.type==="characterData")translateTextNode(mutation.target as Text);
        else if(mutation.type==="attributes")translateAttributes(mutation.target as Element);
        else mutation.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...uiTranslationAttributes]});

    return()=>{
      observer.disconnect();
      for(const [node,original] of originalText)if(node.isConnected&&node.nodeValue===translateUiText(original,language))node.nodeValue=original;
      for(const [element,attributes] of originalAttributes)if(element.isConnected)for(const [name,original] of attributes)if(element.getAttribute(name)===translateUiText(original,language))element.setAttribute(name,original);
      delete document.documentElement.dataset.uiLanguage;
    };
  },[language]);
  return null;
}
