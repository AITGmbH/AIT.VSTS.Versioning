"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";

function addBuildTag(name) {
  tl.command("build.addbuildtag", {}, name)
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
let releaseMode = tl.getPathInput("releaseMode", true);
let artifactAlias = tl.getInput("artifactAlias");
let majorVersionVariableName = tl.getInput("majorVersionVariableName");
let minorVersionVariableName = tl.getInput("minorVersionVariableName");
let patchVersionVariableName = tl.getInput("patchVersionVariableName");
let specialVersionVariableName = tl.getInput("specialVersionVariableName");
let versionVariableName = tl.getInput("versionVariableName");
let cdVersionVariableName = tl.getInput("cdVersionVariableName");
let artifactName = tl.getInput("artifactName", true);


// find artifact
if (artifactAlias == null || artifactAlias == "") {
  tl.getVariables().forEach((item:tl.VariableInfo) => {
    tl.debug(`Variable: '${item.name}' -> '${item.value}'`)
  })
  let aliases =
    tl.getVariables()
    .filter((variable: tl.VariableInfo) => {
      let lower = variable.name.trim().toLowerCase();
      return variable.name.startsWith("release.artifacts.") && variable.name.endsWith(".type"); })
    .map((variable: tl.VariableInfo) => { return variable.name.substr("Release.Artifacts.".length, variable.name.length - ("Release.Artifacts.".length + ".Type".length)); });
    //Object.keys(process.env)
    //.map((variable: string) => {return variable.trim(); })
    //.filter((variable: string) => { return variable.startsWith("RELEASE_ARTIFACTS_") && variable.endsWith("_BUILDID"); })
    //.map((variable: string) => { return variable.substr("RELEASE_ARTIFACTS_".length, variable.length - ("RELEASE_ARTIFACTS_".length + "_BUILDID".length)); });
  if (aliases.length < 1) {
    exitWithError("No suitable artifactalias to handle versioning was found.", 1);
  }

  let primaryBuildId = tl.getVariable("Build.BuildID");
  if (primaryBuildId != null && primaryBuildId != "") {
    let primaryAlias = aliases.find((alias: string) => { return tl.getVariable(`Release.Artifacts.${alias}.BuildId`) == primaryBuildId; });
    //var primaryAlias = aliases.find((alias: string) => { return process.env[`RELEASE_ARTIFACTS_${alias}_BUILDID`] == primaryBuildId; });
    artifactAlias = primaryAlias;
  } else {
    // Take first alias
    artifactAlias = aliases[0];
  }
}

// Check if the required files exist
// $(artefactsDir)/$(artifactAlias)/$(artifactName)/version.release.txt
let artefactsDir = tl.getVariable("Agent.ReleaseDirectory").trim();


let versionText =         fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.txt`, "utf8");
let versionReleaseText =  fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.release.txt`, "utf8");
//var versionCiText =       fs.readFileSync(`${artefactsDir}/${artifactAlias}/${artifactName}/version.ci.txt`, "utf8");

let specialSplits = versionText.split("-");
let rest = "";
if (specialSplits.length > 1) {
  rest = "-" + specialSplits.slice(1).join("-");
}

let version = specialSplits[0].trim();
let versionParts = version.split(".")

let releaseVersionParts = versionReleaseText.split("-")[0].split(".");

let generatePatch = versionParts.length == 2;
if (versionParts.length < 2 || (!generatePatch && versionParts.length != 3)) {
  exitWithError(`The version text of the artefact is not in the correct format. Expected a file containing something similar to '${generatePatch ? "1.0" : "1.0.0" }', but got a file with '${versionText}'`, 1);
}

let majorVersion = releaseVersionParts[0].trim();
setBuildVariable(majorVersionVariableName, majorVersion);

let minorVersion = releaseVersionParts[1].trim();
setBuildVariable(minorVersionVariableName, minorVersion);

let patchVersion = releaseVersionParts[2].trim();
setBuildVariable(patchVersionVariableName, patchVersion);

setBuildVariable(specialVersionVariableName, rest);

let releaseVersion = versionReleaseText
let cdVersion = releaseVersion
// Now we need to be careful as the version number no longer needs to be unique as multiple releases can start with the same build...
let externalReleaseNumber = "";
if (releaseMode == "ReleaseCandidate") {
  let extractReleaseRevision = tl.getInput("extractReleaseRevision", true);
  let re = new RegExp(extractReleaseRevision);
  let releaseName = tl.getVariable("Release.ReleaseName").trim();
  let match = releaseName.match(re);
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
