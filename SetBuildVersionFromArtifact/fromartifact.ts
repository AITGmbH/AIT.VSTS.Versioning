
"use strict";

import * as tl from "vsts-task-lib/task";
import * as fs from "fs";

function addBuildTag(name) {
  tl.command("build.addbuildtag", {}, name)
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

// https://stackoverflow.com/a/2998822/1269722
function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

// https://stackoverflow.com/a/8619946/1269722
function getDayOfYear() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff = now.getTime() - start.getTime();
  var oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

tl.cd(tl.getInput("cwd"));

// read inputs
var releaseMode = tl.getPathInput("releaseMode", true);
var artifactAlias = tl.getInput("artifactAlias");
var majorVersionVariableName = tl.getInput("majorVersionVariableName");
var minorVersionVariableName = tl.getInput("minorVersionVariableName");
var patchVersionVariableName = tl.getInput("patchVersionVariableName");
var specialVersionVariableName = tl.getInput("specialVersionVariableName");
var versionVariableName = tl.getInput("versionVariableName");
var cdVersionVariableName = tl.getInput("cdVersionVariableName");
var artifactName = tl.getInput("artifactName", true);


// find artifact
if (artifactAlias == null || artifactAlias == "") {
  tl.getVariables().forEach((item:tl.VariableInfo) => {
    tl.debug(`Variable: '${item.name}' -> '${item.value}'`)
  })
  var aliases =
    tl.getVariables()
    .filter((variable: tl.VariableInfo) => {
      var lower = variable.name.trim().toLowerCase();
      return variable.name.startsWith("release.artifacts.") && variable.name.endsWith(".type"); })
    .map((variable: tl.VariableInfo) => { return variable.name.substr("Release.Artifacts.".length, variable.name.length - ("Release.Artifacts.".length + ".Type".length)); });
    //Object.keys(process.env)
    //.map((variable: string) => {return variable.trim(); })
    //.filter((variable: string) => { return variable.startsWith("RELEASE_ARTIFACTS_") && variable.endsWith("_BUILDID"); })
    //.map((variable: string) => { return variable.substr("RELEASE_ARTIFACTS_".length, variable.length - ("RELEASE_ARTIFACTS_".length + "_BUILDID".length)); });
  if (aliases.length < 1) {
    exitWithError("No suitable artifactalias to handle versioning was found.", 1);
  }

  var primaryBuildId = tl.getVariable("Build.BuildID");
  if (primaryBuildId != null && primaryBuildId != "") {
    var primaryAlias = aliases.find((alias: string) => { return tl.getVariable(`Release.Artifacts.${alias}.BuildId`) == primaryBuildId; });
    //var primaryAlias = aliases.find((alias: string) => { return process.env[`RELEASE_ARTIFACTS_${alias}_BUILDID`] == primaryBuildId; });
    artifactAlias = primaryAlias;
  } else {
    // Take first alias
    artifactAlias = aliases[0];
  }
}

// Check if the required files exist
// $(artefactsDir)/$(artifactAlias)/$(artifactName)/version.release.txt
var artefactsDir = tl.getVariable("Agent.ReleaseDirectory").trim();


var versionText =         fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.txt`, "utf8");
var versionReleaseText =  fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.release.txt`, "utf8");
var versionCiText =       fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.ci.txt`, "utf8");

var specialSplits = versionText.split("-");
var rest = "";
if (specialSplits.length > 1) {
  rest = "-" + specialSplits.slice(1).join("-");
}

var version = specialSplits[0].trim();
var versionParts = version.split(".")

var releaseVersionParts = versionReleaseText.split("-")[0].split(".");

var generatePatch = versionParts.length == 2;
if (versionParts.length < 2 || (!generatePatch && versionParts.length != 3)) {
  exitWithError(`The version text of the artefact is not in the correct format. Expected a file containing something similar to '${generatePatch ? "1.0" : "1.0.0" }', but got a file with '${versionText}'`, 1);
}

var majorVersion = releaseVersionParts[0].trim();
setBuildVariable(majorVersionVariableName, majorVersion);

var minorVersion = releaseVersionParts[1].trim();
setBuildVariable(minorVersionVariableName, minorVersion);

var patchVersion = releaseVersionParts[2].trim();
setBuildVariable(patchVersionVariableName, patchVersion);

setBuildVariable(specialVersionVariableName, rest);

var releaseVersion = versionReleaseText
var cdVersion = releaseVersion
// Now we need to be careful as the version number no longer needs to be unique as multiple releases can start with the same build...
var externalReleaseNumber = "";
if (releaseMode == "ReleaseCandidate") {
  var extractReleaseRevision = tl.getInput("extractReleaseRevision", true);
  var re = new RegExp(extractReleaseRevision);
  var releaseName = tl.getVariable("Release.ReleaseName").trim();
  var match = releaseName.match(re);
  if (match) {
    externalReleaseNumber = match[1].trim();
  }

  cdVersion = `${majorVersion}.${minorVersion}.${patchVersion}-rc`
  if (externalReleaseNumber != "") {
    cdVersion = `${cdVersion}-${externalReleaseNumber}`
  }
}

setBuildVariable(versionVariableName, releaseVersion);
setBuildVariable(cdVersionVariableName, cdVersion);

addBuildTag(cdVersion);
