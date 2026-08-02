import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:"./tests/e2e",
  timeout:120_000,
  fullyParallel:false,
  retries:0,
  expect:{timeout:15_000},
  reporter:[["list"],["html",{open:"never"}]],
  use:{
    baseURL:process.env.E2E_BASE_URL??"http://localhost:3000",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"retain-on-failure",
  },
  projects:[
    {name:"mobile-chromium",use:{...devices["iPhone 14"],browserName:"chromium",viewport:{width:393,height:852}}},
    {name:"desktop-chromium",use:{browserName:"chromium",viewport:{width:1440,height:900}}},
    {name:"tablet-smoke",grep:/@tablet-smoke/,use:{browserName:"chromium",viewport:{width:768,height:1024}}},
  ],
  webServer:process.env.E2E_BASE_URL?undefined:{command:"npm run start",url:"http://localhost:3000/api/health",reuseExistingServer:true,timeout:120_000},
});
