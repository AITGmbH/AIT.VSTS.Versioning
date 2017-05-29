# How to build

```shell

# First time
npm install -g tfx
npm install -g tsc
cd SetBuildVersionFromRepository && npm install && cd ../SetBuildVersionFromArtifact && npm install && cd ..

# create new version
cd SetBuildVersionFromRepository && tsc && cd ../SetBuildVersionFromArtifact && tsc && cd ..
tfx extension create --manifest-globs vss-extension.json

```
