require("dotenv").config();

const { Firestore } = require("@google-cloud/firestore");
const firestore = new Firestore();

const PROPERTY_COLLECTION = "property";
const STAFF_COLLECTION = "staff";
const TENANT_COLLECTION = "tenant";
const USER_COLLECTIONS = "user";

const USER_ROLE_TENANT = "tenant";
const USER_ROLE_OWNER = "owner";

const USER_ID = "userId";

const populatePropertyDomainMap = async () => {
  const propertyDb = firestore.collection(PROPERTY_COLLECTION);

  const propertyItems = await propertyDb.get();
  const propertyItemsDocs = await propertyItems.docs;

  return propertyItemsDocs.reduce((propertyMap, propertyItem) => {
    const { domainName } = propertyItem.data();
    const propertyId = propertyItem.id;

    if (!domainName) {
      console.log(
        `property ${propertyId} has no domain name. pls do manual check`
      );
      return;
    }
    return { ...propertyMap, [domainName]: propertyId };
  }, {});
};

const migratePropertyId = async () => {
  const propertyDomainIdMap = await populatePropertyDomainMap();

  const usersDb = firestore.collection(USER_COLLECTIONS);
  const staffDb = firestore.collection(STAFF_COLLECTION);
  const tenantDb = firestore.collection(TENANT_COLLECTION);

  const usersItems = await usersDb.get();
  const usersItemsDocs = await usersItems.docs;

  usersItemsDocs.forEach(async (user) => {
    try {
      const { domainId, role } = user.data();
      const userId = user.id;

      if (!domainId || !role) {
        console.log(
          `user ${userId} has no domain id or role. pls do manual check. Skipping for now`
        );
        return;
      }

      const propertyId = propertyDomainIdMap[domainId];

      if (!propertyId) {
        console.error(`no such property document for domain id ${domainId}`);
        return;
      }

      await usersDb.doc(userId).update({ propertyId });

      const targetCollection =
        role === USER_ROLE_OWNER
          ? staffDb
          : role === USER_ROLE_TENANT
          ? tenantDb
          : null;

      if (!targetCollection) {
        console.error(
          `user ${userId} has illegal user role of ${role}. pls remove or fix immediately!`
        );
      }

      const { docs: documents } = await targetCollection
        .where(USER_ID, "==", userId)
        .get();

      if (documents.length !== 1) {
        console.log(
          `user tenant ${userId} has invalid tenant collection document mapping. There are ${documents.length} copies of tenant entry referring to this user. Skipping for now`
        );
        return;
      }

      const [{ id: profileDocumentId }] = documents;

      await tenantDb.doc(profileDocumentId).update({ propertyId });
    } catch (err) {
      console.error(err);
    }
  });
};

migratePropertyId();
