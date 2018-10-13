
"use strict";

import * as tl from "vsts-task-lib/task";
import * as fs from "fs";

function setBuildName(name) {
  tl.command("build.updatebuildnumber", {}, name)
  //console.log("##vso[build.updatebuildnumber]%s", name);
}

function setBuildVariable(variable, value) {
  tl.setVariable(variable, value);
  //console.log("##vso[task.setvariable variable=%s;]%s", variable, name);
  process.env[variable] = value;
}

function exitWithError(message, exitCode) {
  tl.error(message);
  tl.setResult(tl.TaskResult.Failed, message);
  process.exit(exitCode);
}

// http://stackoverflow.com/a/2998822/1269722
function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

// http://stackoverflow.com/a/8619946/1269722
function getDayOfYear() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff = now.getTime() - start.getTime();
  var oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

tl.cd(tl.getInput("cwd"));

// read inputs
var versionTextFile = tl.getPathInput("versionTextFile", true);
var generatePatch = tl.getInput("generatePatch", true) == "true";
var majorVersionVariableName = tl.getInput("majorVersionVariableName");
var minorVersionVariableName = tl.getInput("minorVersionVariableName");
var patchVersionVariableName = tl.getInput("patchVersionVariableName");
var maxPatchVersion = Number.parseInt(tl.getInput("maxPatchVersion"));
var specialVersionVariableName = tl.getInput("specialVersionVariableName");
var versionVariableName = tl.getInput("versionVariableName");
var ciVersionVariableName = tl.getInput("ciVersionVariableName");
var artifactName = tl.getInput("artifactName", true);

var versionText = fs.readFileSync(versionTextFile, "utf8").trim();

var specialSplits = versionText.split("-");
var rest = "";
if (specialSplits.length > 1) {
  rest = "-" + specialSplits.slice(1).join("-").trim();
}

var version = specialSplits[0];
var versionParts = version.split(".")

if (versionParts.length < 2) {
  exitWithError(`The file ${versionTextFile} is not in the correct format. Expected a file containing something similar to '1.0.0' or '1.0' (when generating patch numbers)`, 1);
}

var majorVersion = versionParts[0].trim();
setBuildVariable(majorVersionVariableName, majorVersion);

var minorVersion = versionParts[1].trim();
setBuildVariable(minorVersionVariableName, minorVersion);

// Get some externally unique ID
var externalBuildNumber = "";
// get BUILD_BUILDNUMBER (see https://www.visualstudio.com/en-us/docs/build/define/variables)
var buildNumber = tl.getVariable("Build.BuildNumber").trim();
if (buildNumber != null && (buildNumber!="")) {
  externalBuildNumber = buildNumber;
} else {
  tl.warning("using Build.BuildId as patch number, because Build.BuildNumber was empty.")
  var buildId = tl.getVariable("Build.BuildId").trim();
  if (buildNumber == null || (buildNumber=="")) {
    exitWithError("Could not find Build.BuildNumber or Build.BuildId so no patch number could be generated!", 2);
  }
  externalBuildNumber = buildId;
}

var draft = buildNumber.endsWith(".DRAFT")? ".DRAFT": "";

var unwrappedPatchVersionNumber : number;
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

var unwrappedPatchVersion = unwrappedPatchVersionNumber.toString();

var patchVersionNumber = maxPatchVersion === null || Number.isNaN(maxPatchVersion) ?
                          unwrappedPatchVersionNumber :
                          unwrappedPatchVersionNumber % (1 + maxPatchVersion);
var patchVersion = patchVersionNumber.toString();

setBuildVariable(patchVersionVariableName, patchVersion);

setBuildVariable(specialVersionVariableName, rest);

var releaseVersion = `${majorVersion}.${minorVersion}.${patchVersion}${rest}`
var ciVersion = `${majorVersion}.${minorVersion}.${patchVersion}-ci`
if (generatePatch) {
  // We are already unique if not wrapped around, because of patchVersion
  if (patchVersionNumber !== unwrappedPatchVersionNumber)
  {
    ciVersion = `${ciVersion}-${unwrappedPatchVersion}`
  }
} else {
  // We need to improve ciVersion as we might not update the text file on every build
  ciVersion = `${ciVersion}-${externalBuildNumber}`
}

setBuildVariable(versionVariableName, releaseVersion);
setBuildVariable(ciVersionVariableName, ciVersion);

var artifactDir = versionTextFile + ".artifact";
fs.mkdirSync(artifactDir);
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

var buildName = `${ciVersion}${draft}`;
setBuildName(buildName);
