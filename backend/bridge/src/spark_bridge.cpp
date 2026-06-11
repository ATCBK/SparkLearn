#include "../../../Spark1.5_Windows_SDK_v1.1/include/sparkchain.h"
#include "../../../Spark1.5_Windows_SDK_v1.1/include/sc_llm.h"

#include <atomic>
#include <chrono>
#include <cstring>
#include <iostream>
#include <map>
#include <mutex>
#include <string>
#include <thread>

using namespace SparkChain;

static std::atomic_bool g_finished(false);
static std::mutex g_out_mutex;

std::string json_escape(const char* src) {
    if (!src) return "";
    std::string out;
    for (const char* p = src; *p; ++p) {
        switch (*p) {
            case '\"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += *p; break;
        }
    }
    return out;
}

void print_json_line(const std::string& line) {
    std::lock_guard<std::mutex> lock(g_out_mutex);
    std::cout << line << std::endl;
}

class BridgeCallbacks : public LLMCallbacks {
public:
    void onLLMResult(LLMResult* result, void* usrContext) override {
        (void)usrContext;
        int status = result->getStatus();
        std::string content = json_escape(result->getContent());
        print_json_line("{\"type\":\"text\",\"payload\":{\"content\":\"" + content + "\"}}");
        if (status == 2) {
            print_json_line(
                "{\"type\":\"done\",\"payload\":{\"completion_tokens\":" +
                std::to_string(result->getCompletionTokens()) +
                ",\"prompt_tokens\":" + std::to_string(result->getPromptTokens()) +
                ",\"total_tokens\":" + std::to_string(result->getTotalTokens()) + "}}"
            );
            g_finished = true;
        }
    }

    void onLLMEvent(LLMEvent* event, void* usrContext) override {
        (void)usrContext;
        print_json_line(
            "{\"type\":\"meta\",\"payload\":{\"event_id\":" + std::to_string(event->getEventID()) +
            ",\"event_msg\":\"" + json_escape(event->getEventMsg()) + "\"}}"
        );
    }

    void onLLMError(LLMError* error, void* usrContext) override {
        (void)usrContext;
        print_json_line(
            "{\"type\":\"error\",\"payload\":{\"code\":" + std::to_string(error->getErrCode()) +
            ",\"message\":\"" + json_escape(error->getErrMsg()) + "\"}}"
        );
        g_finished = true;
    }
};

std::map<std::string, std::string> parse_args(int argc, char** argv) {
    std::map<std::string, std::string> args;
    for (int i = 1; i + 1 < argc; i += 2) {
        std::string key = argv[i];
        std::string value = argv[i + 1];
        if (key.rfind("--", 0) == 0) {
            args[key.substr(2)] = value;
        }
    }
    return args;
}

int main(int argc, char** argv) {
    auto args = parse_args(argc, argv);
    std::string app_id = args["app_id"];
    std::string api_key = args["api_key"];
    std::string api_secret = args["api_secret"];
    std::string domain = args.count("domain") ? args["domain"] : "general";
    std::string input = args["input"];

    if (app_id.empty() || api_key.empty() || api_secret.empty() || input.empty()) {
        print_json_line("{\"type\":\"error\",\"payload\":{\"code\":400,\"message\":\"missing required args\"}}");
        return 2;
    }

    SparkChainConfig* config = SparkChainConfig::builder();
    config->appID(app_id.c_str())->apiKey(api_key.c_str())->apiSecret(api_secret.c_str());
    int ret = SparkChain::init(config);
    if (ret != 0) {
        print_json_line(
            "{\"type\":\"error\",\"payload\":{\"code\":" + std::to_string(ret) +
            ",\"message\":\"SparkChain init failed\"}}"
        );
        return ret;
    }

    LLMConfig* llm_config = LLMConfig::builder();
    llm_config->domain(domain.c_str());
    Memory* memory = Memory::WindowMemory(8);
    LLM* llm = LLM::create(llm_config, memory);
    if (!llm) {
        SparkChain::unInit();
        print_json_line("{\"type\":\"error\",\"payload\":{\"code\":500,\"message\":\"LLM create failed\"}}");
        return 3;
    }

    BridgeCallbacks cbs;
    llm->registerLLMCallbacks(&cbs);
    g_finished = false;
    int tag = 1;
    int arun_ret = llm->arun(input.c_str(), &tag);
    if (arun_ret != 0) {
        print_json_line(
            "{\"type\":\"error\",\"payload\":{\"code\":" + std::to_string(arun_ret) +
            ",\"message\":\"LLM arun failed\"}}"
        );
        LLM::destroy(llm);
        SparkChain::unInit();
        return arun_ret;
    }

    int wait_ticks = 0;
    while (!g_finished && wait_ticks++ < 1800) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    if (!g_finished) {
        print_json_line("{\"type\":\"error\",\"payload\":{\"code\":504,\"message\":\"bridge timeout\"}}");
    }

    LLM::destroy(llm);
    SparkChain::unInit();
    return 0;
}

