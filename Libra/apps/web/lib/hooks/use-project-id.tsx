/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-project-id.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

// Define ProjectsTableType type
interface ProjectsTableType {
    id: string
    name: string
    // Add more fields as needed
}

// Define Context type, only keep projectId and projectName
interface ProjectContextProps {
    projectId: string
    projectName: string
    setProjectId: (id: string) => void
    setProjectName: (name: string) => void
}

// Create context
const ProjectContext = createContext<ProjectContextProps | undefined>(undefined)

// Create Provider component
export const ProjectProvider = ({
                                    projectName: initialProjectName,
                                    projectId: initialProjectId,
                                    children,
                                }: {
    projectName: string
    projectId: string
    children: ReactNode
}) => {
    const [projectName, setProjectName] = useState<string>(initialProjectName)
    const [projectId, setProjectId] = useState<string>(initialProjectId)

    // Add logging for state changes

    return (
        <ProjectContext.Provider
            value={{
                projectId,
                projectName,
                setProjectId,
                setProjectName,
            }}
        >
            {children}
        </ProjectContext.Provider>
    )
}

// Custom hook to access context
export const useProjectContext = () => {
    const context = useContext(ProjectContext)
    if (!context) {
        throw new Error('useProjectContext must be used within a ProjectProvider')
    }
    return context
}
