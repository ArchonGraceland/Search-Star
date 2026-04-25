import { requireInstitutionalPortal } from '@/lib/feature-flags'
import EnrollForm from './enroll-form'

export default function InstitutionEnrollPage() {
  requireInstitutionalPortal()
  return <EnrollForm />
}
