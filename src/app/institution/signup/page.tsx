import { requireInstitutionalPortal } from '@/lib/feature-flags'
import SignupForm from './signup-form'

export default function InstitutionSignupPage() {
  requireInstitutionalPortal()
  return <SignupForm />
}
