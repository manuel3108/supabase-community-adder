import { AstTypes } from '@svelte-cli/core';

/**
 * @param {import("@svelte-cli/core").TextFileEditor<typeof import('./options.js').options>} editor
 * @returns
 */
export function generateEnvFileContent(editor) {
    let { content, options } = editor;
    content = addEnvVar(content, 'PUBLIC_BASE_URL', '"http://localhost:5173"');
    content = addEnvVar(
        content,
        'PUBLIC_SUPABASE_URL',
        // Local development env always has the same credentials, prepopulate the local dev env file
        options.cli
            ? '"http://127.0.0.1:54321"'
            : '"<your_supabase_project_url>"'
    );
    content = addEnvVar(
        content,
        'PUBLIC_SUPABASE_ANON_KEY',
        // Local development env always has the same credentials, prepopulate the local dev env file
        options.cli
            ? '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"'
            : '"<your_supabase_anon_key>"'
    );

    content = options.admin
        ? addEnvVar(
              content,
              'SUPABASE_SERVICE_ROLE_KEY',
              // Local development env always has the same credentials, prepopulate the local dev env file
              options.cli
                  ? '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"'
                  : '"<your_supabase_service_role_key>"'
          )
        : content;

    return content;
}

/**
 * @param {string} content
 * @param {string} key
 * @param {string} value
 * @returns
 */
export function addEnvVar(content, key, value) {
    if (!content.includes(key + '=')) {
        content = appendContent(content, `${key}=${value}`);
    }
    return content;
}

/**
 * @param {string} existing
 * @param {string} content
 * @returns
 */
export function appendContent(existing, content) {
    const withNewLine =
        !existing.length || existing.endsWith('\n')
            ? existing
            : existing + '\n';
    return withNewLine + content + '\n';
}

/**
 * @param {string} name
 * @param {boolean} typescript
 * @returns {AstTypes.TSInterfaceBody['body'][number]}
 */
export function createSupabaseType(name, typescript) {
    return {
        type: 'TSPropertySignature',
        key: {
            type: 'Identifier',
            name,
        },
        typeAnnotation: {
            type: 'TSTypeAnnotation',
            typeAnnotation: {
                type: 'TSTypeReference',
                typeName: {
                    type: 'Identifier',
                    name: 'SupabaseClient',
                },
                typeParameters: typescript
                    ? {
                          type: 'TSTypeParameterInstantiation',
                          params: [
                              {
                                  type: 'TSTypeReference',
                                  typeName: {
                                      type: 'Identifier',
                                      name: 'Database',
                                  },
                              },
                          ],
                      }
                    : undefined,
            },
        },
    };
}

/**
 *
 * @param {string} name
 * @returns {AstTypes.TSInterfaceBody['body'][number]}
 */
export function createSafeGetSessionType(name) {
    return {
        type: 'TSPropertySignature',
        key: {
            type: 'Identifier',
            name,
        },
        typeAnnotation: {
            type: 'TSTypeAnnotation',
            typeAnnotation: {
                type: 'TSFunctionType',
                typeAnnotation: {
                    type: 'TSTypeAnnotation',
                    typeAnnotation: {
                        type: 'TSTypeReference',
                        typeName: {
                            type: 'Identifier',
                            name: 'Promise',
                        },
                        typeParameters: {
                            type: 'TSTypeParameterInstantiation',
                            params: [
                                {
                                    type: 'TSTypeLiteral',
                                    members: [
                                        createSessionType('session'),
                                        createUserType('user'),
                                    ],
                                },
                            ],
                        },
                    },
                },
                parameters: [],
            },
        },
    };
}

/**
 * @param {string} name
 * @returns {AstTypes.TSPropertySignature}
 */
export function createSessionType(name) {
    return {
        type: 'TSPropertySignature',
        key: {
            type: 'Identifier',
            name,
        },
        typeAnnotation: {
            type: 'TSTypeAnnotation',
            typeAnnotation: {
                type: 'TSUnionType',
                types: [
                    {
                        type: 'TSTypeReference',
                        typeName: {
                            type: 'Identifier',
                            name: 'Session',
                        },
                    },
                    {
                        type: 'TSNullKeyword',
                    },
                ],
            },
        },
    };
}

/**
 * @param {string} name
 * @returns {AstTypes.TSPropertySignature}
 */
export function createUserType(name) {
    return {
        type: 'TSPropertySignature',
        key: {
            type: 'Identifier',
            name,
        },
        typeAnnotation: {
            type: 'TSTypeAnnotation',
            typeAnnotation: {
                type: 'TSUnionType',
                types: [
                    {
                        type: 'TSTypeReference',
                        typeName: {
                            type: 'Identifier',
                            name: 'User',
                        },
                    },
                    {
                        type: 'TSNullKeyword',
                    },
                ],
            },
        },
    };
}

export function getSupabaseHandleContent() {
    return `
		async ({ event, resolve }) => {
		event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' })
					})
				},
			},
		})

		event.locals.safeGetSession = async () => {
			const {
				data: { session },
			} = await event.locals.supabase.auth.getSession()
			if (!session) {
				return { session: null, user: null }
			}

			const {
				data: { user },
				error,
			} = await event.locals.supabase.auth.getUser()
			if (error) {
				return { session: null, user: null }
			}

			return { session, user }
		}

		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version'
			},
		});
	};`;
}

/**
 * @param {boolean} isDemo
 * @returns {string}
 */
export function getAuthGuardHandleContent(isDemo) {
    return `
		async ({ event, resolve }) => {
			const { session, user } = await event.locals.safeGetSession()
			event.locals.session = session
			event.locals.user = user
			${
                isDemo
                    ? `
			if (!event.locals.session && event.url.pathname.startsWith('/private')) {
				redirect(303, '/auth')
			}

			if (event.locals.session && event.url.pathname === '/auth') {
				redirect(303, '/private')
			}
			`
                    : `
			// Add authentication guards here
			`
            }
			return resolve(event);
		}`;
}
