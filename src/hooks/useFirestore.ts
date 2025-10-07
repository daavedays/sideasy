import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  WhereFilterOp,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * useFirestore Hook
 * 
 * General-purpose hook for Firestore CRUD operations.
 * Provides methods for reading, writing, updating, and deleting documents.
 * 
 * Location: src/hooks/useFirestore.ts
 * Purpose: Simplified Firestore operations hook
 */

interface UseFirestoreReturn {
  loading: boolean;
  error: string | null;
  getDocument: <T = DocumentData>(collectionName: string, docId: string) => Promise<T | null>;
  getDocuments: <T = DocumentData>(collectionName: string, constraints?: QueryConstraint[]) => Promise<T[]>;
  addDocument: (collectionName: string, data: DocumentData) => Promise<string>;
  updateDocument: (collectionName: string, docId: string, data: Partial<DocumentData>) => Promise<void>;
  deleteDocument: (collectionName: string, docId: string) => Promise<void>;
  queryDocuments: <T = DocumentData>(
    collectionName: string,
    field: string,
    operator: WhereFilterOp,
    value: any
  ) => Promise<T[]>;
}

export const useFirestore = (): UseFirestoreReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDocument = async <T = DocumentData>(
    collectionName: string,
    docId: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get document');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getDocuments = async <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> => {
    setLoading(true);
    setError(null);
    try {
      const collectionRef = collection(db, collectionName);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get documents');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addDocument = async (
    collectionName: string,
    data: DocumentData
  ): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateDocument = async (
    collectionName: string,
    docId: string,
    data: Partial<DocumentData>
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (
    collectionName: string,
    docId: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const queryDocuments = async <T = DocumentData>(
    collectionName: string,
    field: string,
    operator: WhereFilterOp,
    value: any
  ): Promise<T[]> => {
    setLoading(true);
    setError(null);
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, where(field, operator, value));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query documents');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getDocument,
    getDocuments,
    addDocument,
    updateDocument,
    deleteDocument,
    queryDocuments
  };
};

export default useFirestore;

