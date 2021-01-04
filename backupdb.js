require("dotenv").config();
const { RESULT_FOLDER_NAME } = process.env;

const fs = require("fs");
const { backup, backups, initializeApp } = require("firestore-export-import");
const { Firestore } = require("@google-cloud/firestore");

const serviceAccount = require("./firebase-key.json");
const appName = "teman-app";
initializeApp(serviceAccount, appName);

const firestore = new Firestore();

const getCollectionsList = async () => {
  try {
    const collectionsList = await firestore.listCollections();

    return collectionsList.map(
      (collection) => collection["_queryOptions"]["collectionId"]
    );
  } catch (err) {
    throw err;
  }
};

const checkAndMakeResultFolder = async () => {
  try {
    await fs.promises.access(`${__dirname}/${RESULT_FOLDER_NAME}`);
    return true;
  } catch (err) {
    return false;
  }
};

const writeBackupToFile = async (collectionName, content) => {
  try {
    await fs.promises.writeFile(
      `${__dirname}/${RESULT_FOLDER_NAME}/${collectionName}.json`,
      content,
      "utf8"
    );
  } catch (err) {
    throw err;
  }
};

const backupCollection = async (collectionName) => {
  try {
    const tableContent = await backup(collectionName);
    const tableJSON = JSON.stringify(tableContent, null, 4);

    await writeBackupToFile(collectionName, tableJSON);
  } catch (err) {
    throw err;
  }
};

const backupAllCollection = async () => {
  try {
    const collectionNames = await getCollectionsList();

    const backupFolderExists = await checkAndMakeResultFolder();

    if (!backupFolderExists) {
      await fs.promises.mkdir(`${__dirname}/${RESULT_FOLDER_NAME}`);
    }

    await Promise.all(
      collectionNames.forEach(
        (collection) => collection && backupCollection(collection)
      )
    );
  } catch (err) {
    console.error(err);
  }
};

backupAllCollection();
