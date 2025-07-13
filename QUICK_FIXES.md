# 🔧 QUICK TYPESCRIPT FIXES

## **server/services/okta.ts**

### Line 81 - Fix property name:
```typescript
// WRONG:
clientCredentialsClientSecret

// CORRECT:
clientCredentialsClientId
```

### Lines 120, 121, 122, 141, 142, 143 - Fix error types:
```typescript
// WRONG:
} catch (error) {
  console.error('Error getting client credentials token:', error);
  console.error('Response status:', error.response?.status);
  console.error('Response data:', JSON.stringify(error.response?.data, null, 2));

// CORRECT:
} catch (error: any) {
  console.error('Error getting client credentials token:', error);
  console.error('Response status:', error.response?.status);
  console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
```

## **server/services/pam.ts**

### Lines 55, 56, 174, 175, 234, 235 - Fix error types:
```typescript
// WRONG:
} catch (error) {
  console.error('Error getting PAM service bearer token:', error);
  console.error('Response status:', error.response?.status);

// CORRECT:
} catch (error: any) {
  console.error('Error getting PAM service bearer token:', error);
  console.error('Response status:', error.response?.status);
```

## **Search & Replace Strategy:**
1. **In okta.ts:** Find `clientCredentialsClientSecret` → Replace with `clientCredentialsClientId`
2. **In okta.ts:** Find all `catch (error)` → Replace with `catch (error: any)`
3. **In pam.ts:** Find all `catch (error)` → Replace with `catch (error: any)`

These are simple text replacements that will resolve all 11 TypeScript compilation errors.