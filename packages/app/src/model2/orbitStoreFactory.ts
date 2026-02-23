import { OrbitStore } from "@withorbit/store-shared";
import OrbitStoreFS from "@withorbit/store-fs";

export async function createOrbitStore(
  databaseName: string,
): Promise<OrbitStore> {
  return new OrbitStoreFS(databaseName);
}
