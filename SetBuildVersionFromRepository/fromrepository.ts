"use strict";

import * as tl from "vsts-task-lib/task";
import * as fs from "fs";

function setBuildName(name) {
  tl.command("build.updatebuildnumber", {}, name)
}

function setBuildVariable(variable, value) {
  tl.setVariable(variable, value);
  process.env[variable] = value;
}

function exitWithError(message, exitCode) {
  tl.error(message);
  tl.setResult(tl.TaskResult.Failed, message);
  process.exit(exitCode);
}

tl.cd(tl.getInput("cwd"));

// read inputs
let versionTextFile = tl.getPathInput("versionTextFile", true);
let generatePatch = tl.getInput("generatePatch", true) == "true";
let majorVersionVariableName = tl.getInput("majorVersionVariableName");
let minorVersionVariableName = tl.getInput("minorVersionVariableName");
let patchVersionVariableName = tl.getInput("patchVersionVariableName");
let maxPatchVersion = Number.parseInt(tl.getInput("maxPatchVersion"));
let specialVersionVariableName = tl.getInput("specialVersionVariableName");
let versionVariableName = tl.getInput("versionVariableName");
let ciVersionVariableName = tl.getInput("ciVersionVariableName");
let artifactName = tl.getInput("artifactName", true);

let versionText = fs.readFileSync(versionTextFile, "utf8").trim();

let specialSplits = versionText.split("-");
let rest = "";
if (specialSplits.length > 1) {
  rest = "-" + specialSplits.slice(1).join("-").trim();
}

let version = specialSplits[0];
let versionParts = version.split(".")

if (versionParts.length < 2) {
  exitWithError(`The file ${versionTextFile} is not in the correct format. Expected a file containing something similar to '1.0.0' or '1.0' (when generating patch numbers)`, 1);
}

let majorVersion = versionParts[0].trim();
setBuildVariable(majorVersionVariableName, majorVersion);

let minorVersion = versionParts[1].trim();
setBuildVariable(minorVersionVariableName, minorVersion);

// Get some externally unique ID
let externalBuildNumber = "";
// get BUILD_BUILDNUMBER (see https://www.visualstudio.com/en-us/docs/build/define/variables)

let buildId = tl.getVariable("Build.BuildId").trim();
let buildNumber = tl.getVariable("Build.BuildNumber").trim();
externalBuildNumber = buildId;
if (externalBuildNumber == null || (externalBuildNumber == "")) {
  tl.warning("using Build.BuildNumber as patch number, because Build.BuildId was empty.")
  externalBuildNumber = buildNumber;
  if (externalBuildNumber == null || (externalBuildNumber=="")) {
    exitWithError("Could not find Build.BuildNumber or Build.BuildId so no patch number could be generated!", 2);
  }
}


let draft = buildNumber.endsWith(".DRAFT")? ".DRAFT": "";

let unwrappedPatchVersionNumber : number;
if (generatePatch) {
  if (versionParts.length > 2) {
    exitWithError(`The file ${versionTextFile} is not in the correct format. Expected a file containing something similar to '1.0' (because patch part is generated)`, 1);
  }

  unwrappedPatchVersionNumber = Number.parseInt(externalBuildNumber);
} else {
  if (versionParts.length < 3 || versionParts.length > 3) {
    exitWithError(`The file ${versionTextFile} is not in the correct format. Expected a file containing something similar to '1.0.0'`, 1);
  }

  unwrappedPatchVersionNumber = Number.parseInt(versionParts[2].trim());
}

let unwrappedPatchVersion = unwrappedPatchVersionNumber.toString();

let patchVersionNumber = maxPatchVersion === null || Number.isNaN(maxPatchVersion) ?
                          unwrappedPatchVersionNumber :
                          unwrappedPatchVersionNumber % (1 + maxPatchVersion);
let patchVersion = patchVersionNumber.toString();

setBuildVariable(patchVersionVariableName, patchVersion);

setBuildVariable(specialVersionVariableName, rest);

let releaseVersion = `${majorVersion}.${minorVersion}.${patchVersion}${rest}`
let ciVersion = `${majorVersion}.${minorVersion}.${patchVersion}-ci`
if (generatePatch) {
  // We are already unique if not wrapped around, because of patchVersion
  if (patchVersionNumber !== unwrappedPatchVersionNumber) {
    ciVersion = `${ciVersion}-${unwrappedPatchVersion}`
  }
} else {
  // We need to improve ciVersion as we might not update the text file on every build
  if (buildNumber == null || (buildNumber == "")) {
    ciVersion = `${ciVersion}`
  } else {
    ciVersion = `${ciVersion}-${buildNumber}`
  }
}

setBuildVariable(versionVariableName, releaseVersion);
setBuildVariable(ciVersionVariableName, ciVersion);

let artifactDir = versionTextFile + ".artifact";
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir);
}

fs.writeFileSync(artifactDir + "/version.release.txt", releaseVersion, 'utf8');
fs.writeFileSync(artifactDir + "/version.txt", versionText, 'utf8');
fs.writeFileSync(artifactDir + "/version.ci.txt", ciVersion, 'utf8');

let data = {
    artifacttype: "container",
    artifactname: artifactName,
    containerfolder: artifactName,
    // add localpath to ##vso command's properties for back compat of old Xplat agent
    localpath: artifactDir
};

tl.command("artifact.upload", data, artifactDir);
let buildName = `${ciVersion}`;
if (generatePatch) {
  buildName = `${ciVersion}${draft}`;
}

setBuildName(buildName);
