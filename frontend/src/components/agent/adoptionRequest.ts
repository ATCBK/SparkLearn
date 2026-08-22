import type { AgentPet, AdoptPetPayload } from '@/lib/api'

export type AdoptionMode = 'adopt' | 'readopt'

export type PetAdoptionInput = AdoptPetPayload & {
  mode: AdoptionMode
}

export type PetAdoptionRequest =
  | { action: 'create'; payload: AdoptPetPayload }
  | { action: 'resetAndCreate'; payload: AdoptPetPayload }

export function buildPetAdoptionRequest(input: PetAdoptionInput): PetAdoptionRequest {
  const payload = {
    name: input.name.trim(),
    avatar: input.avatar as AgentPet['avatar'],
    personality: input.personality as AgentPet['personality'],
  }

  if (input.mode === 'readopt') {
    return { action: 'resetAndCreate', payload }
  }

  return { action: 'create', payload }
}
