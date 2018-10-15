# How to build

```shell

# First time
npm install -g tfx-cli
cd SetBuildVersionFromRepository && npm install && cd ../SetBuildVersionFromArtifact && npm install && cd ..

# create new version
cd SetBuildVersionFromRepository && npm run tsc && cd ../SetBuildVersionFromArtifact && npm run tsc && cd ..
tfx extension create --manifest-globs vss-extension.json

```
