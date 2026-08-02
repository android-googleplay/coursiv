import { expect, test } from "@playwright/test";

test("@tablet-smoke auth and member shells do not overflow horizontally",async({page})=>{
  for(const route of ["/login","/onboarding","/dashboard","/courses","/ai-tools","/games","/profile","/certificates"]){
    await page.goto(route);await page.waitForLoadState("domcontentloaded");
    const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    expect(geometry.scrollWidth,`${route} overflows the 768px tablet viewport`).toBeLessThanOrEqual(geometry.clientWidth+1);
  }
});
