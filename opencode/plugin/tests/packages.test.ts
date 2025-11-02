import { test } from "bun:test"
import { PackagesPlugin } from "../packages"
import { $ } from "bun"

test("Get_maven_package_version nwb-auth-common (groupId=com.nwboxed.integration, versionPrefix=1.)", async () => {
    const plugin = await PackagesPlugin({})

    const result = await plugin.tool?.get_maven_package_version?.execute({
        groupId: "com.nwboxed.integration",
        artifactId: "nwb-auth-common",
        versionPrefix: "1"
    })

    console.log(result)
})

//Get_maven_package_version kotlin-bom (groupId=org.jetbrains.kotlin, versionPrefix=2.1)

test("Get_maven_package_version kotlin-bom (groupId=org.jetbrains.kotlin, versionPrefix=2.1)", async () => {
    const plugin = await PackagesPlugin({})

    const result = await plugin.tool?.get_maven_package_version?.execute({
        groupId: "org.jetbrains.kotlin",
        artifactId: "kotlin-bom",
        versionPrefix: "2.1"
    })

    console.log(result)
})

test("Get_maven_package_version bcprov-ext-jdk15to18 (groupId=org.bouncycastle, versionPrefix=1.)", async () => {
    const plugin = await PackagesPlugin({})

    const result = await plugin.tool?.get_maven_package_version?.execute({
        groupId: "org.bouncycastle",
        artifactId: "bcprov-ext-jdk15to18",
        versionPrefix: "1."
    })

    console.log(result)
})

test("Get_maven_package_version bcprov-ext-jdk15to18 (groupId=org.bouncycastle)", async () => {
    const plugin = await PackagesPlugin({})

    const result = await plugin.tool?.get_maven_package_version?.execute({
        groupId: "org.bouncycastle",
        artifactId: "bcprov-ext-jdk15to18",
    })

    console.log(result)
})

test("Get_maven_package_version junit-platform-reporting (groupId=org.junit.platform, versionPrefix=1.13)", async () => {
    const plugin = await PackagesPlugin({})

    const result = await plugin.tool?.get_maven_package_version?.execute({
        groupId: "org.junit.platform",
        artifactId: "junit-platform-reporting",
        versionPrefix: "1.13"
    })

    console.log(result)
})