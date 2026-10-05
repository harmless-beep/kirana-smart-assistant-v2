import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8')
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-kirana',
  firestore: { rules },
})

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'profiles/shop-a'), {
      id: 'shop-a', name: 'Shop A', phone: '9800000000', role: 'owner', migration_snapshot: 'fixture',
    })
    await setDoc(doc(context.firestore(), 'users/shop-a/products/7'), {
      id: 7, user_id: 'shop-a', name: 'Rice', quantity: 10, barcode: null,
    })
  })

  const shopA = testEnv.authenticatedContext('shop-a').firestore()
  const shopB = testEnv.authenticatedContext('shop-b').firestore()
  const anonymous = testEnv.unauthenticatedContext().firestore()

  await assertSucceeds(getDoc(doc(shopA, 'profiles/shop-a')))
  await assertFails(getDoc(doc(shopB, 'profiles/shop-a')))
  await assertFails(getDoc(doc(anonymous, 'users/shop-a/products/7')))
  await assertFails(setDoc(doc(testEnv.authenticatedContext('new-owner').firestore(), 'profiles/new-owner'), {
    id: 'new-owner', name: 'New Shop', phone: '9800000001', role: 'admin',
  }))
  await assertFails(setDoc(doc(shopA, 'users/shop-b/products/8'), {
    id: 8, user_id: 'shop-b', name: 'Unsafe', quantity: 1, barcode: null,
  }))
  await assertFails(updateDoc(doc(shopA, 'profiles/shop-a'), { role: 'staff' }))
  await assertFails(updateDoc(doc(shopA, 'profiles/shop-a'), { id: 'shop-b' }))
  await assertFails(updateDoc(doc(shopA, 'profiles/shop-a'), { legacy_user_id: 99 }))
  await assertSucceeds(updateDoc(doc(shopA, 'profiles/shop-a'), { phone: '9811111111', name: 'Shop A Owner' }))
  await assertFails(updateDoc(doc(shopA, 'users/shop-a/products/7'), { user_id: 'shop-b' }))
  await assertFails(updateDoc(doc(shopA, 'users/shop-a/products/7'), { migration_snapshot: 'forged' }))
  await assertFails(updateDoc(doc(shopA, 'users/shop-a/products/7'), { quantity: -1 }))
  await assertSucceeds(updateDoc(doc(shopA, 'users/shop-a/products/7'), { quantity: 9 }))
  await assertFails(setDoc(doc(shopA, 'users/shop-a/sales/new-sale'), {
    id: 'new-sale', user_id: 'shop-a', total_amount: 10, profit: 2,
    payment_method: 'cash', items: [],
  }))

  console.log('Firestore rules tests passed: owner isolation, unauthenticated denial, immutable profile identity, protected shop ownership, and valid inventory update.')
} finally {
  await testEnv.cleanup()
}
