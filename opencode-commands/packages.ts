import { type Plugin, tool } from "@opencode-ai/plugin"
import semanticCompare from "semantic-compare";
import { XMLParser} from "fast-xml-parser";

// const parser = new XMLParser();
// let jObj = parser.parse(XMLdata);

export const PackagesPlugin: Plugin = async ({ $ }) => {
  return {
    tool: {
      get_maven_package_version: tool({
        description: `Get latest available version of a Maven package. Includes private packages`,
        args: {
          groupId: tool.schema.string("Maven group ID (e.g., 'org.springframework.boot')"),
          artifactId: tool.schema.string("Maven artifact ID (e.g., 'spring-boot-starter')"),
          versionPrefix: tool.schema.string("<Major> or <major>.<minor> version to filter by (e.g., '3', '2.74', '1.846')"),
        },
        async execute(args) {
          const versionPrefix = args.versionPrefix?.replace(/\.$/g, '');
          let isDependencyOwnedByUs = false

          let allVersions = await getMavenPackageVersions(args.groupId, args.artifactId);
          console.log(allVersions)

          if (!allVersions?.length) {
            allVersions = await getJfrogPackageVersions(args.groupId, args.artifactId);
            isDependencyOwnedByUs = true
          }

          const versions = filterVersions(allVersions, versionPrefix);
          
          const result = versions.length ? {
            success: true,
            versions,
            instructions: isDependencyOwnedByUs ? `The ${args.groupId}:${args.artifactId} dependency is an internal package published by NWBoxed/Mettle.
If the latest version still contains a vulnerability, DO NOT add constraints to force an upgrade of an external transitive dependency.
Instead instruct the user the fix the vulnerability in the ${args.groupId}:${args.artifactId} package itself and release a new version.
` : undefined
          } : {
            success: false,
            error: `No versions found for ${args.groupId}:${args.artifactId}`
          }

          return JSON.stringify(result);
        },
      }),
    },
  }
}

interface MavenSearchResponse {
  response: {
    numFound: number;
    docs: Array<{
      g: string;
      a: string;
      v: string;
      timestamp: number;
    }>;
  };
}

interface JFrogSearchResponse {
  results: Array<{
    uri: string
  }>;
}

function parseVersion(version: string): Array<number | undefined> {
  const cleanVersion = version.replace(/[^0-9.]/g, '');
  return cleanVersion.split('.').map(part => parseInt(part) || undefined);
}

function matchesSemanticVersionPrefix(version: string, prefix: string): boolean {
  const versionParts = parseVersion(version);
  const prefixParts = parseVersion(prefix);
  
  for (let i = 0; i < prefixParts.length; i++) {
    if (prefixParts[i] === undefined) {
      continue;
    }
    if (i >= versionParts.length || versionParts[i] !== prefixParts[i]) {
      return false;
    }
  }
  
  return true;
}

const filterVersions = (versions: string[], versionPrefix?: string): Array<string> => {
  const validVersions = versions.filter(v => v !== null) as string[];
  
  return validVersions.filter(v => matchesSemanticVersionPrefix(v, versionPrefix || '')).sort(semanticCompare).reverse();
}

async function getJfrogPackageVersions(groupId: string, artifactId: string): Promise<string[]> {
    const jfrogPassword = process.env.JFROG_PASSWORD;
  
    const searchUrl = `https://mettle.jfrog.io/artifactory/api/search/artifact?name=${artifactId}&repos=gradle-release-local`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'X-JFrog-Art-Api': jfrogPassword!,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`JFrog API request failed: ${response.status} ${response.statusText}`);
    }

    const data: JFrogSearchResponse = await response.json() as any;

    const versions = data.results.map(result => {
      if (result.uri.includes(groupId.replace(/\./g, '/')) && result.uri.includes(artifactId)) {
        const versionMatch = result.uri.match(/\/([0-9]+(?:\.[0-9]+)*(?:-[a-zA-Z0-9]+)?)\//);
        if (versionMatch) {
          return versionMatch[1];
        } else {
          return undefined
        }
      }
    }).filter(v => v !== undefined)
    
    return versions;
}

async function getMavenPackageVersions(
  groupId: string, 
  artifactId: string
): Promise<string[]> {
  const searchUrl = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&core=gav&rows=300&wt=json`;
  
  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    throw new Error(`Maven Central request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as MavenSearchResponse;
  
  return data.response.docs.map(doc => doc.v)
}
