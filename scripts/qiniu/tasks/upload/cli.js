const { createUploadTask } = require("./index");

async function main() {
  const [, , moduleName, filePath, remoteFileName] = process.argv;
  if (!moduleName || !filePath) {
    throw new Error(
      "用法：npm run qiniu:upload -- <模块名> <本地文件路径> [远端文件名]",
    );
  }

  const uploader = createUploadTask();
  const result = await uploader.uploadLocalFile({
    moduleName,
    filePath,
    fileName: remoteFileName,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
