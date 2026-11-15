import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { collection, doc, getDocsFromServer, getFirestore, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

export function connectAccounts(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    observe: (next, error) => onAuthStateChanged(auth, next, error),
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    cartFor: uid => cartStore(db, uid),
  };
}

function cartStore(db, uid) {
  const items = collection(db, "carts", uid, "items");
  const snapshotsToLines = snapshot => snapshot.docs.map(item => item.data());

  return {
    async load(guestLines) {
      if (guestLines.length) {
        await changeLines(guestLines.map(item => ({ item, mergeGuest: true })));
      }
      return snapshotsToLines(await getDocsFromServer(items));
    },

    watch(next, error) {
      return onSnapshot(items, { includeMetadataChanges: true }, snapshot => {
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) next(snapshotsToLines(snapshot));
      }, error);
    },

    save(before, after) {
      const previous = new Map(before.map(item => [lineId(item), item]));
      const next = new Map(after.map(item => [lineId(item), item]));
      const changes = [];
      for (const id of new Set([...previous.keys(), ...next.keys()])) {
        const oldItem = previous.get(id);
        const newItem = next.get(id);
        const delta = (newItem?.quantity || 0) - (oldItem?.quantity || 0);
        if (delta) changes.push({ item: newItem || oldItem, delta });
      }
      return changeLines(changes);
    },
  };

  async function changeLines(changes) {
    if (!changes.length) return [];
    return runTransaction(db, async transaction => {
      const refs = changes.map(({ item }) => doc(items, lineId(item)));
      const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      return changes.map(({ item, mergeGuest, delta }, index) => {
        const current = snapshots[index].data()?.quantity || 0;
        const quantity = mergeGuest ? Math.max(current, item.quantity) : current + delta;
        if (quantity > 9) throw new Error("Maximum quantity reached for this configuration.");
        if (quantity > 0) {
          const saved = { ...item, quantity };
          transaction.set(refs[index], saved);
          return [lineId(item), saved];
        }
        transaction.delete(refs[index]);
        return [lineId(item), null];
      });
    });
  }
}

export function lineId(item) {
  return [item.frameId, item.lens, item.prescription, item.rxId].filter(Boolean).join("_");
}
