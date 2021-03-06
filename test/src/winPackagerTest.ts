import { Platform } from "out"
import test from "./helpers/avaEx"
import { assertPack, platform, modifyPackageJson } from "./helpers/packTester"
import { move } from "fs-extra-p"
import * as path from "path"
import { WinPackager, computeDistOut } from "out/winPackager"
import { BuildInfo } from "out/platformPackager"
import { Promise as BluebirdPromise } from "bluebird"
import * as assertThat from "should/as-function"

//noinspection JSUnusedLocalSymbols
const __awaiter = require("out/awaiter")

test.ifNotTravis("win", () => assertPack("test-app-one", platform(Platform.WINDOWS),
  {
    tempDirCreated: process.env.TEST_DELTA ? it => modifyPackageJson(it, data => {
      data.build.win = {
        remoteReleases: "https://github.com/develar/__test-app-releases",
      }
    }) : null
  }
))

test.ifNotTravis("noMsi as string", t => t.throws(assertPack("test-app-one", platform(Platform.WINDOWS),
  {
    tempDirCreated: it => modifyPackageJson(it, data => {
      data.build.win = {
        noMsi: "false",
      }
    })
  }), `noMsi expected to be boolean value, but string '"false"' was specified`)
)

test("detect install-spinner", () => {
  let platformPackager: CheckingWinPackager = null
  let loadingGifPath: string = null

  // todo all PackagerOptions should be optional otherwise it is not possible to pass only several to override dev package.json
  const devMetadata: any = {
    build: {
      win: {
        certificatePassword: "pass",
      }
    }
  }
  return assertPack("test-app-one", {
    platform: [Platform.WINDOWS],
    platformPackagerFactory: (packager, platform, cleanupTasks) => platformPackager = new CheckingWinPackager(packager, cleanupTasks),
    devMetadata: devMetadata
  }, {
    tempDirCreated: it => {
      loadingGifPath = path.join(it, "build", "install-spinner.gif")
      return BluebirdPromise.all([
        move(path.join(it, "install-spinner.gif"), loadingGifPath),
        modifyPackageJson(it, data => {
          data.build.win = {
            certificateFile: "secretFile",
            certificatePassword: "mustBeOverridden",
          }
        })])
    },
    packed: () => {
      assertThat(platformPackager.effectiveDistOptions.loadingGif).equal(loadingGifPath)
      assertThat(platformPackager.effectiveDistOptions.certificateFile).equal("secretFile")
      return BluebirdPromise.resolve(null)
    },
  })
})

test.ifNotTravis("icon < 256", (t: any) => t.throws(assertPack("test-app-one", platform(Platform.WINDOWS), {
  tempDirCreated: projectDir => move(path.join(projectDir, "build", "incorrect.ico"), path.join(projectDir, "build", "icon.ico"), {clobber: true})
}), /Windows icon image size must be at least 256x256/))

class CheckingWinPackager extends WinPackager {
  effectiveDistOptions: any

  constructor(info: BuildInfo, cleanupTasks: Array<() => Promise<any>>) {
    super(info, cleanupTasks)
  }

  async pack(outDir: string, arch: string): Promise<string> {
    // skip pack
    return this.computeAppOutDir(outDir, arch)
  }

  async packageInDistributableFormat(outDir: string, appOutDir: string, arch: string): Promise<any> {
    const installerOutDir = computeDistOut(outDir, arch)
    this.effectiveDistOptions = await this.computeEffectiveDistOptions(appOutDir, installerOutDir)
  }
}