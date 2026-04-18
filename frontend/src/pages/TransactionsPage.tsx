import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function TransactionsPage({ children }: Props) {
  return <div>{children}</div>
}
