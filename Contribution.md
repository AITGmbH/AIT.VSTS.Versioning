# How to build
Notice:
To build locally you have to change the attribute Categories in the file vss-extension.json.
If you want a local deployment of the extension for TFS 2018 and older, replace the value __ExtensionCategory___ with "Build and release".
In all other cases (the default case in most cases) replace the value __ExtensionCategory___ with "Azure Pipelines".

For build processes, it is also recommended to customize the ID of the extension as well as the task, adding a suffix for the local variant of the extension is recommended so that the offline and variant are distinguishable.

If the extension is distributed via the Visual Studio Marketplace in connected/online mode (no direct vsix download), then "Azure Pipelines" is always the category for all supported TFS versions.

```shell

# First time
npm install -g tfx-cli
cd SetBuildVersionFromRepository && npm install && cd ../SetBuildVersionFromArtifact && npm install && cd ..

# create new version
cd SetBuildVersionFromRepository && npm run tsc && cd ../SetBuildVersionFromArtifact && npm run tsc && cd ..
tfx extension create --manifest-globs vss-extension.json

```

